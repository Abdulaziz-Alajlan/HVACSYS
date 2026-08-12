// Typed client for the AirWise FastAPI backend (see backend/app/routes/*.py).

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ApiZone {
  id: number;
  name: string;
  floor: number;
  room_type: string;
  area: number;
  capacity: number;
  target_temperature: number;
  min_airflow: number;
  max_airflow: number;
}

export interface ApiReading {
  id: number;
  zone_id: number;
  timestamp: string;
  temperature: number;
  humidity: number;
  occupancy: number;
  airflow: number;
  damper_position: number;
  energy_consumption: number;
  outdoor_temperature: number;
}

export interface ApiPrediction {
  id: number;
  zone_id: number;
  timestamp: string;
  horizon_minutes: number;
  predicted_temperature: number;
  predicted_cooling_demand: number;
  confidence: number;
  model_version: string;
}

export interface ApiRecommendation {
  id: number;
  zone_id: number;
  timestamp: string;
  action: 'increase_airflow' | 'decrease_airflow' | 'maintain';
  current_airflow: number;
  recommended_airflow: number;
  reason: string;
  estimated_energy_change: number;
  comfort_impact: 'improves' | 'neutral' | 'degrades' | null;
  status: string;
}

export interface ApiRecommendationApplyResult {
  recommendation: ApiRecommendation;
  new_reading: ApiReading;
}

export type ApiScenario = 'occupancy_surge' | 'hot_outdoor_period' | 'blocked_damper';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getZones: () => apiFetch<ApiZone[]>('/api/zones'),
  getZoneReadings: (zoneId: number, limit = 288) =>
    apiFetch<ApiReading[]>(`/api/zones/${zoneId}/readings?limit=${limit}`),
  predictZone: (zoneId: number) => apiFetch<ApiPrediction>(`/api/predict/${zoneId}`, { method: 'POST' }),
  recommendZone: (zoneId: number) =>
    apiFetch<ApiRecommendation>(`/api/recommendations/${zoneId}`, { method: 'POST' }),
  applyRecommendation: (id: number) =>
    apiFetch<ApiRecommendationApplyResult>(`/api/recommendations/${id}/apply`, { method: 'POST' }),
  triggerScenario: (zoneId: number, scenario: ApiScenario) =>
    apiFetch<ApiReading>(`/api/zones/${zoneId}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    }),
};
