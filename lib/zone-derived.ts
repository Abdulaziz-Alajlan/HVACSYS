// Shared derivation formulas for turning raw zone/reading data into display
// fields (comfort score, cooling status, issue flags). Used by both the
// dashboard (hvac-live-data.ts) and the HVAC Builder (builder-store.ts) so
// the two can't drift the way a room's target temperature once did — one
// surface synced it from the real zone, the other left it at whatever
// random mock value the default layout started with. One formula, used
// everywhere, removes that whole class of bug.

import type { CoolingStatus } from './hvac-types';

export function computeComfortScore(
  currentTemp: number,
  targetTemp: number,
  occupancy: number,
  capacity: number
): number {
  const tempDeviation = Math.abs(currentTemp - targetTemp);
  const occupancyRatio = capacity > 0 ? occupancy / capacity : 0;
  return Math.max(30, Math.min(100, 100 - tempDeviation * 15 - occupancyRatio * 10));
}

export function deriveCoolingStatus(damperPosition: number, occupancy: number): CoolingStatus {
  if (occupancy === 0 && damperPosition < 20) return 'Inactive Cooling';
  if (damperPosition >= 70) return 'Coolers Started';
  if (damperPosition >= 30) return 'Comfort Cooling';
  return 'Expected to Start in a Bit';
}

export function computeIssueFlags(
  currentTemp: number,
  targetTemp: number,
  occupancy: number,
  capacity: number,
  airflow: number,
  roomType: string
): string[] {
  const issueFlags: string[] = [];
  const tempDeviation = Math.abs(currentTemp - targetTemp);
  if (tempDeviation > 3) issueFlags.push('Temperature deviation');
  if (occupancy > capacity * 0.9) issueFlags.push('Near capacity');
  if (airflow < 300 && roomType !== 'lobby') issueFlags.push('Low airflow');
  return issueFlags;
}
