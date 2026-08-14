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
import type { LiveRecommendation, Room, RoomType, TimeSeriesPoint } from './hvac-types';
import { computeComfortScore, computeIssueFlags, deriveCoolingStatus } from './zone-derived';

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

/**
 * `aiEnabled` gates only the optimizer/recommendation call — forecasting
 * (predictZone) stays on regardless, since a temperature forecast isn't an
 * "AI control action" the way a damper recommendation is. With AI off, this
 * is the real baseline: no recommendations are generated at all, so
 * computeDemandInsights' energySavingsKwh naturally comes out to 0 rather
 * than being a fabricated "AI disabled" placeholder value.
 */
export async function fetchLiveZoneBundles(aiEnabled: boolean): Promise<LiveZoneBundle[]> {
  const zones = await api.getZones();
  const relevant = zones.filter((z) => ZONE_ROOM_META[z.name]);

  const bundles = await Promise.all(
    relevant.map(async (zone): Promise<LiveZoneBundle | null> => {
      const history = await api.getZoneReadings(zone.id, HISTORY_LIMIT);
      const latestReading = history[history.length - 1];
      if (!latestReading) return null; // zone has no readings yet

      const [prediction, recommendation] = await Promise.all([
        api.predictZone(zone.id).catch(() => null),
        aiEnabled ? api.recommendZone(zone.id).catch(() => null) : Promise.resolve(null),
      ]);
      return { zone, latestReading, history, prediction, recommendation };
    })
  );

  return bundles.filter((b): b is LiveZoneBundle => b !== null);
}

export function bundleToRoom(bundle: LiveZoneBundle): Room {
  const { zone, latestReading, prediction, history } = bundle;
  const meta = ZONE_ROOM_META[zone.name];

  const comfortScore = computeComfortScore(
    latestReading.temperature,
    zone.target_temperature,
    latestReading.occupancy,
    zone.capacity
  );
  const issueFlags = computeIssueFlags(
    latestReading.temperature,
    zone.target_temperature,
    latestReading.occupancy,
    zone.capacity,
    latestReading.airflow,
    zone.room_type
  );

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
    damperPosition: Math.round(latestReading.damper_position),
    airflowEstimate: Math.round(latestReading.airflow),
    scheduleStatus: null,
    priorityLevel: meta.priority,
    issueFlags,
    temperatureHistory: history.map((r) => ({ time: new Date(r.timestamp), value: r.temperature })),
  };
}

/** Maps a bundle's real per-zone recommendation onto a display card. Returns
 * null when there isn't one — AI off, or the per-zone recommend call failed
 * — so callers can filter those out rather than showing a placeholder. */
export function bundleToRecommendation(bundle: LiveZoneBundle): LiveRecommendation | null {
  const { zone, recommendation } = bundle;
  if (!recommendation) return null;
  const meta = ZONE_ROOM_META[zone.name];

  return {
    id: recommendation.id,
    roomId: meta.id,
    zoneName: zone.name,
    action: recommendation.action,
    reason: recommendation.reason,
    estimatedEnergyChange: recommendation.estimated_energy_change,
    comfortImpact: recommendation.comfort_impact,
    status: recommendation.status,
    timestamp: recommendation.timestamp,
    isReal: true,
  };
}

/** Real per-zone cooling-capacity utilization at the current moment, 0-100.
 * Replaces the mock coolingUnits' `load` field for the live "Cooling Load"
 * KPI — mirrors the same airflow/max_airflow ratio used in
 * computeUtilizationHistory below, just for the single latest reading. */
export function computeCoolingLoadPercentage(bundles: LiveZoneBundle[]): number {
  if (bundles.length === 0) return 0;
  const total = bundles.reduce((sum, b) => {
    const util = b.zone.max_airflow > 0 ? (b.latestReading.airflow / b.zone.max_airflow) * 100 : 0;
    return sum + Math.min(100, Math.max(0, util));
  }, 0);
  return Math.round(total / bundles.length);
}

/** Real fleet-wide utilization/efficiency/power series for the Utilization
 * Chart, built from the same 288-point reading history already fetched per
 * zone (see fetchLiveZoneBundles) — replaces generateUtilizationHistory()'s
 * Math.random() output when dataSource is 'live'.
 *
 * Zones can have slightly different history lengths (a zone seeded/synced
 * later has fewer points), so points are aligned from the most recent
 * reading backwards across zones rather than by absolute index, using
 * whichever zone has the longest history as the time axis. */
export function computeUtilizationHistory(bundles: LiveZoneBundle[]): TimeSeriesPoint[] {
  if (bundles.length === 0) return [];

  const pointCount = Math.min(...bundles.map((b) => b.history.length));
  if (pointCount === 0) return [];
  const timeBase = bundles.reduce((longest, b) => (b.history.length > longest.history.length ? b : longest));

  const points: TimeSeriesPoint[] = [];
  for (let offsetFromEnd = pointCount; offsetFromEnd >= 1; offsetFromEnd--) {
    let utilizationSum = 0;
    let comfortSum = 0;
    let powerSum = 0;
    let activatedZones = 0;

    for (const bundle of bundles) {
      const reading = bundle.history[bundle.history.length - offsetFromEnd];
      const util = bundle.zone.max_airflow > 0 ? (reading.airflow / bundle.zone.max_airflow) * 100 : 0;
      utilizationSum += Math.min(100, Math.max(0, util));
      comfortSum += computeComfortScore(
        reading.temperature,
        bundle.zone.target_temperature,
        reading.occupancy,
        bundle.zone.capacity
      );
      // energy_consumption is kWh per 5-min tick; *12 converts to an hourly kW rate.
      powerSum += reading.energy_consumption * 12;
      if (reading.damper_position > 0) activatedZones += 1;
    }

    const timeReading = timeBase.history[timeBase.history.length - offsetFromEnd];
    points.push({
      time: new Date(timeReading.timestamp),
      utilization: Math.round(utilizationSum / bundles.length),
      efficiency: Math.round(comfortSum / bundles.length),
      activatedZones,
      powerUsage: Math.round(powerSum * 10) / 10,
    });
  }

  return points;
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
