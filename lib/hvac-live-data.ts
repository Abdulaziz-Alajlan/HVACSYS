// Maps real backend zone/reading/prediction/recommendation data onto the
// existing frontend Room/KPI shapes, so the dashboard renders real data
// without every downstream component needing to change.
//
// Only the 8 zones seeded by backend/simulation/seed_database.py have real
// data; the frontend's original mock room list had 12. The 4 extra rooms
// (A-103, B-203, C-302, D-402) have no backend zone and are dropped rather
// than left half-mocked, so the dashboard doesn't mix real and fake rows
// that look identical to a viewer.

import { api, type ApiPrediction, type ApiReading, type ApiRecommendation, type ApiZone } from './api';
import type { CoolingStatus, Room, RoomType } from './hvac-types';

const HISTORY_LIMIT = 288; // 24h at 5-min intervals

// Frontend-only presentation metadata (which mock AHU/damper "serves" each
// zone, and its display priority) — there's no backend concept of this, so
// it stays a static lookup rather than being invented server-side. IDs match
// the original mock room list so the still-mock coolingUnits/dampers arrays
// (see hvac-mock-data.ts) keep working unchanged.
const ZONE_ROOM_META: Record<string, { id: string; damper: string; unit: string; priority: Room['priorityLevel'] }> = {
  'A-101': { id: 'room-1', damper: 'damper-1', unit: 'cu-1', priority: 'medium' },
  'A-102': { id: 'room-2', damper: 'damper-1', unit: 'cu-1', priority: 'high' },
  'A-104': { id: 'room-4', damper: 'damper-2', unit: 'cu-1', priority: 'high' },
  'B-201': { id: 'room-5', damper: 'damper-3', unit: 'cu-2', priority: 'critical' },
  'B-202': { id: 'room-6', damper: 'damper-3', unit: 'cu-2', priority: 'medium' },
  'C-301': { id: 'room-8', damper: 'damper-5', unit: 'cu-3', priority: 'critical' },
  'D-401': { id: 'room-10', damper: 'damper-6', unit: 'cu-4', priority: 'low' },
  'D-403': { id: 'room-12', damper: 'damper-6', unit: 'cu-4', priority: 'medium' },
};

export interface LiveZoneBundle {
  zone: ApiZone;
  latestReading: ApiReading;
  history: ApiReading[];
  prediction: ApiPrediction | null;
  recommendation: ApiRecommendation | null;
}

export async function fetchLiveZoneBundles(): Promise<LiveZoneBundle[]> {
  const zones = await api.getZones();
  const relevant = zones.filter((z) => ZONE_ROOM_META[z.name]);

  const bundles = await Promise.all(
    relevant.map(async (zone): Promise<LiveZoneBundle | null> => {
      const history = await api.getZoneReadings(zone.id, HISTORY_LIMIT);
      const latestReading = history[history.length - 1];
      if (!latestReading) return null; // zone has no readings yet

      const [prediction, recommendation] = await Promise.all([
        api.predictZone(zone.id).catch(() => null),
        api.recommendZone(zone.id).catch(() => null),
      ]);
      return { zone, latestReading, history, prediction, recommendation };
    })
  );

  return bundles.filter((b): b is LiveZoneBundle => b !== null);
}

function deriveCoolingStatus(damperPosition: number, occupancy: number): CoolingStatus {
  if (occupancy === 0 && damperPosition < 20) return 'Inactive Cooling';
  if (damperPosition >= 70) return 'Coolers Started';
  if (damperPosition >= 30) return 'Comfort Cooling';
  return 'Expected to Start in a Bit';
}

export function bundleToRoom(bundle: LiveZoneBundle): Room {
  const { zone, latestReading, prediction, history } = bundle;
  const meta = ZONE_ROOM_META[zone.name];

  const tempDeviation = Math.abs(latestReading.temperature - zone.target_temperature);
  const occupancyRatio = zone.capacity > 0 ? latestReading.occupancy / zone.capacity : 0;
  const comfortScore = Math.max(30, Math.min(100, 100 - tempDeviation * 15 - occupancyRatio * 10));

  const issueFlags: string[] = [];
  if (tempDeviation > 3) issueFlags.push('Temperature deviation');
  if (latestReading.occupancy > zone.capacity * 0.9) issueFlags.push('Near capacity');
  if (latestReading.airflow < 300 && zone.room_type !== 'lobby') issueFlags.push('Low airflow');

  return {
    id: meta.id,
    name: zone.name,
    roomType: zone.room_type as RoomType,
    currentTemp: Math.round(latestReading.temperature * 10) / 10,
    targetTemp: zone.target_temperature,
    predictedTemp: prediction ? Math.round(prediction.predicted_temperature * 10) / 10 : latestReading.temperature,
    occupancyCount: latestReading.occupancy,
    capacity: zone.capacity,
    comfortScore: Math.round(comfortScore),
    openDuration: 0,
    coolingStatus: deriveCoolingStatus(latestReading.damper_position, latestReading.occupancy),
    expectedCoolingStartTime: null,
    assignedCoolingUnit: meta.unit,
    connectedDamper: meta.damper,
    airflowEstimate: Math.round(latestReading.airflow),
    scheduleStatus: null,
    priorityLevel: meta.priority,
    issueFlags,
    temperatureHistory: history.map((r) => ({ time: new Date(r.timestamp), value: r.temperature })),
  };
}

export interface LiveDemandInsights {
  demandTrend: 'increasing' | 'decreasing' | 'low';
  peakDemandTime: Date;
  energySavingsKwh: number;
}

const LOW_DEMAND_THRESHOLD_KWH = 0.05; // fleet-wide 30-min energy below this reads as "low", not a trend

/** Derives the AI Insights panel's real-data numbers from the same bundles used for rooms. */
export function computeDemandInsights(bundles: LiveZoneBundle[]): LiveDemandInsights {
  const totalPredicted30 = bundles.reduce((sum, b) => sum + (b.prediction?.predicted_cooling_demand ?? 0), 0);
  const totalCurrentRate30 = bundles.reduce((sum, b) => sum + b.latestReading.energy_consumption * 6, 0);

  let demandTrend: LiveDemandInsights['demandTrend'];
  if (totalPredicted30 < LOW_DEMAND_THRESHOLD_KWH && totalCurrentRate30 < LOW_DEMAND_THRESHOLD_KWH) {
    demandTrend = 'low';
  } else {
    demandTrend = totalPredicted30 > totalCurrentRate30 ? 'increasing' : 'decreasing';
  }

  // Historical-pattern peak: which hour-of-day has had the highest average
  // energy draw across the fetched history, not a multi-hour-ahead forecast
  // (the ML model only predicts 30 min out) — a standard BMS heuristic.
  const hourTotals = new Array(24).fill(0);
  const hourCounts = new Array(24).fill(0);
  for (const bundle of bundles) {
    for (const reading of bundle.history) {
      const hour = new Date(reading.timestamp).getHours();
      hourTotals[hour] += reading.energy_consumption;
      hourCounts[hour] += 1;
    }
  }
  const hourAverages = hourTotals.map((total, i) => (hourCounts[i] ? total / hourCounts[i] : 0));
  const peakHour = hourAverages.indexOf(Math.max(...hourAverages));
  const peakDemandTime = new Date();
  peakDemandTime.setHours(peakHour >= 0 ? peakHour : 14, 0, 0, 0);

  // Total kWh the AI's current recommendations would save over the next 30
  // min versus doing nothing, summed across zones (only counting savings,
  // not the zones where the optimizer recommends using more energy for comfort).
  const energySavingsKwh = bundles.reduce((sum, b) => {
    const delta = b.recommendation?.estimated_energy_change ?? 0;
    return sum + Math.max(0, -delta);
  }, 0);

  return { demandTrend, peakDemandTime, energySavingsKwh: Math.round(energySavingsKwh * 100) / 100 };
}
