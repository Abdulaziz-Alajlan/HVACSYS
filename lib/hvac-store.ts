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
} from './hvac-mock-data';
import {
  fetchLiveZoneBundles,
  bundleToRoom,
  bundleToRecommendation,
  computeDemandInsights,
  computeCoolingLoadPercentage,
  computeUtilizationHistory,
} from './hvac-live-data';
import { computeComfortScore, computeIssueFlags, deriveCoolingStatus } from './zone-derived';
import { api } from './api';
import { toast } from 'sonner';

// Builds a full dashboard state from real backend data: rooms,
// recommendations, the Cooling Load KPI, and the utilization history all
// come directly from live zones/readings/predictions/recommendations.
// Cooling units, dampers, schedules, and maintenance events have no backend
// model yet, so they're still mock-generated, but issues/schedules are
// derived FROM the real rooms (those generators already take rooms as
// input), so they stay consistent with the real numbers shown elsewhere.
async function buildLiveState(aiEnabled: boolean): Promise<HVACSystemState> {
  const bundles = await fetchLiveZoneBundles(aiEnabled);
  if (bundles.length === 0) {
    throw new Error('Backend returned no zone data');
  }

  const rooms = bundles.map(bundleToRoom);
  const coolingUnits = generateCoolingUnits();
  const dampers = generateDampers(coolingUnits);
  const schedules = generateSchedules(rooms);
  const issues = generateIssues(coolingUnits, dampers, rooms);
  const maintenanceEvents = generateMaintenanceEvents(coolingUnits);
  const recommendations = bundles
    .map(bundleToRecommendation)
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const utilizationHistory = computeUtilizationHistory(bundles);
  const insights = computeDemandInsights(bundles);

  const activeRooms = rooms.filter((r) => r.coolingStatus !== 'Inactive Cooling');
  const avgComfort = rooms.reduce((sum, r) => sum + r.comfortScore, 0) / (rooms.length || 1);

  const kpis: KPIData = {
    totalActiveRooms: activeRooms.length,
    totalRooms: rooms.length,
    coolingLoadPercentage: computeCoolingLoadPercentage(bundles),
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
    dataSource: 'live',
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
  reopenIssue: (id: string) => void;
  setTimeRange: (range: '1h' | '24h' | '7d') => void;
  refreshData: () => Promise<void>;
  applyRecommendation: (id: number) => Promise<void>;

  // UI State
  selectedRoomId: string | null;
  selectedCoolingUnitId: string | null;
  selectedDamperId: string | null;
  timeRange: '1h' | '24h' | '7d';
  highlightedRoomId: string | null;
  // True only until the first initialize() resolves (success or fallback to
  // mock). Distinguishes "still loading" from "this building genuinely has
  // 0 active rooms" — before this flag existed both looked identical.
  isInitialLoading: boolean;

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
      dataSource: 'live',

      // UI State
      selectedRoomId: null,
      selectedCoolingUnitId: null,
      selectedDamperId: null,
      timeRange: '24h',
      highlightedRoomId: null,
      isInitialLoading: true,

      // Actions
      initialize: async () => {
        const state = get();
        // Only initialize if not already loaded
        if (state.rooms.length > 0) return;
        const version = ++liveFetchVersion;
        try {
          const liveState = await buildLiveState(get().aiOptimizationActive);
          if (version !== liveFetchVersion) return; // superseded by a newer fetch
          // Manually-created schedules (added via the Schedule dialog) aren't
          // backend-derived, so buildLiveState's freshly-regenerated
          // schedules shouldn't blindly replace them — merge instead.
          const manualSchedules = get().schedules.filter((s) => s.source === 'manual');
          set({
            ...liveState,
            schedules: [...manualSchedules, ...liveState.schedules],
            aiOptimizationActive: get().aiOptimizationActive,
            isInitialLoading: false,
          });
        } catch (err) {
          if (version !== liveFetchVersion) return;
          console.error('Failed to load live backend data, falling back to mock data:', err);
          set({ ...generateInitialHVACState(), isInitialLoading: false });
        }
      },
      
      toggleAIOptimization: () => {
        set(state => ({ aiOptimizationActive: !state.aiOptimizationActive }));
        // Refetch immediately so the toggle has a visible effect right away
        // (recommendations start/stop being generated) rather than waiting
        // for the next manual refresh. refreshData() handles its own
        // errors/versioning, so this doesn't need to be awaited here.
        void get().refreshData();
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

      // Powers the "Undo" action on the acknowledge/resolve toasts — these
      // are fire-and-forget status changes with no confirm step, so an undo
      // path is the lower-friction alternative to a confirm dialog.
      reopenIssue: (id) => {
        set(state => ({
          issues: state.issues.map(i => i.id === id ? { ...i, status: 'open' as const } : i),
        }));
      },
      
      setTimeRange: (range) => {
        set({ timeRange: range });
      },
      
      refreshData: async () => {
        const version = ++liveFetchVersion;
        try {
          const liveState = await buildLiveState(get().aiOptimizationActive);
          if (version !== liveFetchVersion) return; // superseded by a newer fetch
          const manualSchedules = get().schedules.filter((s) => s.source === 'manual');
          set({
            ...liveState,
            schedules: [...manualSchedules, ...liveState.schedules],
            aiOptimizationActive: get().aiOptimizationActive,
          });
        } catch (err) {
          if (version !== liveFetchVersion) return;
          console.error('Failed to refresh live backend data, falling back to mock data:', err);
          set(generateInitialHVACState());
        }
      },

      // Mirrors the Builder's applyRecommendation action (lib/builder-store.ts):
      // calls the real backend, which runs an actual physics tick, then
      // recomputes the affected room's derived fields from the returned
      // reading via the same zone-derived.ts formulas.
      applyRecommendation: async (id) => {
        const rec = get().recommendations.find((r) => r.id === id);
        if (!rec || !rec.isReal || rec.status !== 'pending') return;

        try {
          const result = await api.applyRecommendation(id);
          const reading = result.new_reading;
          set((state) => ({
            recommendations: state.recommendations.map((r) =>
              r.id === id ? { ...r, status: 'applied' } : r
            ),
            rooms: state.rooms.map((room) => {
              if (room.id !== rec.roomId) return room;
              return {
                ...room,
                currentTemp: reading.temperature,
                occupancyCount: reading.occupancy,
                airflowEstimate: Math.round(reading.airflow),
                damperPosition: Math.round(reading.damper_position),
                comfortScore: Math.round(
                  computeComfortScore(reading.temperature, room.targetTemp, reading.occupancy, room.capacity)
                ),
                coolingStatus: deriveCoolingStatus(reading.damper_position, reading.occupancy),
                issueFlags: computeIssueFlags(
                  reading.temperature,
                  room.targetTemp,
                  reading.occupancy,
                  room.capacity,
                  reading.airflow,
                  room.roomType
                ),
              };
            }),
          }));
          toast.success(`Applied AI recommendation to ${rec.zoneName}`);
        } catch (err) {
          console.error(`Failed to apply recommendation for ${rec.zoneName}:`, err);
          toast.error(`Failed to apply recommendation for ${rec.zoneName}`);
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
