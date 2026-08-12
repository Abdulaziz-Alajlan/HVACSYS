'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HVACSystemState, KPIData, Schedule, Room, CoolingUnit, Damper } from './hvac-types';
import {
  generateInitialHVACState,
  simulateUpdate,
  generateCoolingUnits,
  generateDampers,
  generateSchedules,
  generateIssues,
  generateMaintenanceEvents,
  generateRecommendations,
  generateUtilizationHistory,
} from './hvac-mock-data';
import { fetchLiveZoneBundles, bundleToRoom, computeDemandInsights } from './hvac-live-data';

// Builds a full dashboard state from real backend data: rooms come from
// live zones/readings/predictions/recommendations; cooling units, dampers,
// schedules, issues, and maintenance events have no backend model yet, so
// they're still mock-generated, but issues/schedules/recommendations are
// derived FROM the real rooms (those generators already take rooms as
// input), so they stay consistent with the real numbers shown elsewhere.
async function buildLiveState(): Promise<HVACSystemState> {
  const bundles = await fetchLiveZoneBundles();
  if (bundles.length === 0) {
    throw new Error('Backend returned no zone data');
  }

  const rooms = bundles.map(bundleToRoom);
  const coolingUnits = generateCoolingUnits();
  const dampers = generateDampers(coolingUnits);
  const schedules = generateSchedules(rooms);
  const issues = generateIssues(coolingUnits, dampers, rooms);
  const maintenanceEvents = generateMaintenanceEvents(coolingUnits);
  const recommendations = generateRecommendations(rooms, dampers, coolingUnits);
  const utilizationHistory = generateUtilizationHistory();
  const insights = computeDemandInsights(bundles);

  const activeRooms = rooms.filter((r) => r.coolingStatus !== 'Inactive Cooling');
  const avgComfort = rooms.reduce((sum, r) => sum + r.comfortScore, 0) / (rooms.length || 1);
  const totalLoad = coolingUnits.reduce((sum, u) => sum + u.load, 0) / (coolingUnits.length || 1);

  const kpis: KPIData = {
    totalActiveRooms: activeRooms.length,
    totalRooms: rooms.length,
    coolingLoadPercentage: Math.round(totalLoad),
    estimatedEnergySavings: insights.energySavingsKwh,
    averageComfortScore: Math.round(avgComfort),
    openIssuesCount: issues.filter((i) => i.status === 'open').length,
    predictedPeakDemandTime: insights.peakDemandTime,
    demandTrend: insights.demandTrend,
  };

  return {
    coolingUnits,
    dampers,
    rooms,
    schedules,
    issues,
    maintenanceEvents,
    recommendations,
    kpis,
    utilizationHistory,
    lastUpdated: new Date(),
    aiOptimizationActive: true,
    simulationRunning: false,
  };
}

interface HVACStore extends HVACSystemState {
  // Actions
  initialize: () => Promise<void>;
  toggleAIOptimization: () => void;
  toggleSimulation: () => void;
  runSimulationTick: () => void;
  addSchedule: (schedule: Schedule) => void;
  removeSchedule: (id: string) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  updateCoolingUnit: (id: string, updates: Partial<CoolingUnit>) => void;
  updateDamper: (id: string, updates: Partial<Damper>) => void;
  acknowledgeIssue: (id: string) => void;
  resolveIssue: (id: string) => void;
  setTimeRange: (range: '1h' | '24h' | '7d') => void;
  refreshData: () => Promise<void>;
  
  // UI State
  selectedRoomId: string | null;
  selectedCoolingUnitId: string | null;
  selectedDamperId: string | null;
  timeRange: '1h' | '24h' | '7d';
  highlightedRoomId: string | null;
  
  setSelectedRoom: (id: string | null) => void;
  setSelectedCoolingUnit: (id: string | null) => void;
  setSelectedDamper: (id: string | null) => void;
  setHighlightedRoom: (id: string | null) => void;
}

// Guards initialize()/refreshData() against out-of-order responses: if a
// newer live-data fetch starts before an older one resolves (e.g. the user
// clicks Refresh twice, or a click races the mount-time initialize() call),
// only the result of the most recently started fetch is applied. Same
// version-counter pattern zustand's own persist middleware uses to guard
// concurrent rehydrate() calls.
let liveFetchVersion = 0;

export const useHVACStore = create<HVACStore>()(
  persist(
    (set, get) => ({
      // Initial empty state
      coolingUnits: [],
      dampers: [],
      rooms: [],
      schedules: [],
      issues: [],
      maintenanceEvents: [],
      recommendations: [],
      kpis: {
        totalActiveRooms: 0,
        totalRooms: 0,
        coolingLoadPercentage: 0,
        estimatedEnergySavings: 0,
        averageComfortScore: 0,
        openIssuesCount: 0,
        predictedPeakDemandTime: new Date(),
        demandTrend: 'low',
      },
      utilizationHistory: [],
      lastUpdated: new Date(),
      aiOptimizationActive: true,
      simulationRunning: false,
      
      // UI State
      selectedRoomId: null,
      selectedCoolingUnitId: null,
      selectedDamperId: null,
      timeRange: '24h',
      highlightedRoomId: null,
      
      // Actions
      initialize: async () => {
        const state = get();
        // Only initialize if not already loaded
        if (state.rooms.length > 0) return;
        const version = ++liveFetchVersion;
        try {
          const liveState = await buildLiveState();
          if (version !== liveFetchVersion) return; // superseded by a newer fetch
          set({ ...liveState, aiOptimizationActive: get().aiOptimizationActive });
        } catch (err) {
          if (version !== liveFetchVersion) return;
          console.error('Failed to load live backend data, falling back to mock data:', err);
          set(generateInitialHVACState());
        }
      },
      
      toggleAIOptimization: () => {
        set(state => ({ aiOptimizationActive: !state.aiOptimizationActive }));
      },
      
      toggleSimulation: () => {
        set(state => ({ simulationRunning: !state.simulationRunning }));
      },
      
      runSimulationTick: () => {
        const state = get();
        if (state.simulationRunning) {
          const newState = simulateUpdate(state);
          set({
            rooms: newState.rooms,
            coolingUnits: newState.coolingUnits,
            dampers: newState.dampers,
            kpis: newState.kpis,
            lastUpdated: newState.lastUpdated,
          });
        }
      },
      
      addSchedule: (schedule) => {
        set(state => ({
          schedules: [...state.schedules, schedule],
        }));
      },
      
      removeSchedule: (id) => {
        set(state => ({
          schedules: state.schedules.filter(s => s.id !== id),
        }));
      },
      
      updateRoom: (id, updates) => {
        set(state => ({
          rooms: state.rooms.map(r => r.id === id ? { ...r, ...updates } : r),
        }));
      },
      
      updateCoolingUnit: (id, updates) => {
        set(state => ({
          coolingUnits: state.coolingUnits.map(u => u.id === id ? { ...u, ...updates } : u),
        }));
      },
      
      updateDamper: (id, updates) => {
        set(state => ({
          dampers: state.dampers.map(d => d.id === id ? { ...d, ...updates } : d),
        }));
      },
      
      acknowledgeIssue: (id) => {
        set(state => ({
          issues: state.issues.map(i => i.id === id ? { ...i, status: 'acknowledged' as const } : i),
        }));
      },
      
      resolveIssue: (id) => {
        set(state => ({
          issues: state.issues.map(i => i.id === id ? { ...i, status: 'resolved' as const } : i),
        }));
      },
      
      setTimeRange: (range) => {
        set({ timeRange: range });
      },
      
      refreshData: async () => {
        const version = ++liveFetchVersion;
        try {
          const liveState = await buildLiveState();
          if (version !== liveFetchVersion) return; // superseded by a newer fetch
          set({ ...liveState, aiOptimizationActive: get().aiOptimizationActive });
        } catch (err) {
          if (version !== liveFetchVersion) return;
          console.error('Failed to refresh live backend data, falling back to mock data:', err);
          set(generateInitialHVACState());
        }
      },
      
      // UI State setters
      setSelectedRoom: (id) => set({ selectedRoomId: id }),
      setSelectedCoolingUnit: (id) => set({ selectedCoolingUnitId: id }),
      setSelectedDamper: (id) => set({ selectedDamperId: id }),
      setHighlightedRoom: (id) => set({ highlightedRoomId: id }),
    }),
    {
      name: 'hvac-storage',
      partialize: (state) => ({
        schedules: state.schedules,
        aiOptimizationActive: state.aiOptimizationActive,
        timeRange: state.timeRange,
      }),
    }
  )
);
