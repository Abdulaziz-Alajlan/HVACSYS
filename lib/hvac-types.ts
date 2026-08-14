// HVAC System Types

export type CoolingStatus = 
  | 'Inactive Cooling'
  | 'Comfort Cooling'
  | 'Expected to Start in a Bit'
  | 'Coolers Started'
  | 'Starting in 10 Minutes';

export type Severity = 'info' | 'warning' | 'critical';

export type ScheduleStatus = 'Active' | 'Upcoming' | 'Completed' | 'Recurring';

export type EquipmentStatus = 'Healthy' | 'Attention Needed' | 'Maintenance Due' | 'Degraded';

export type ComfortStatus = 'Optimal' | 'Slight Drift' | 'At Risk' | 'Uncomfortable';

export type RoomType = 'office' | 'meeting-room' | 'lab' | 'hallway' | 'classroom' | 'executive-office' | 'server-room' | 'lobby';

export interface CoolingUnit {
  id: string;
  name: string;
  type: 'AHU' | 'FCU' | 'Chiller' | 'Split';
  status: EquipmentStatus;
  utilization: number; // 0-100
  efficiency: number; // 0-100
  load: number; // 0-100
  maxCapacity: number; // kW
  energyConsumption: number; // kWh
  zoneCoverage: string[];
  healthScore: number; // 0-100
  maintenanceDueDate: Date;
  maintenanceStatus: 'Up to date' | 'Due soon' | 'Overdue';
  warningFlags: string[];
  trendHistory: { time: Date; value: number }[];
}

export interface Damper {
  id: string;
  name: string;
  openness: number; // 0-100
  actuatorStatus: 'Normal' | 'Slow Response' | 'Stuck' | 'Error';
  healthScore: number; // 0-100
  airflowEstimate: number; // CFM
  linkedCoolingUnit: string;
  linkedRooms: string[];
  lastAdjustmentTime: Date;
  issueFlag: string | null;
  trendHistory: { time: Date; value: number }[];
}

export interface Room {
  id: string;
  name: string;
  roomType: RoomType;
  currentTemp: number; // °C
  targetTemp: number; // °C
  predictedTemp: number; // °C
  occupancyCount: number;
  capacity: number;
  comfortScore: number; // 0-100
  openDuration: number; // minutes - door/window open
  coolingStatus: CoolingStatus;
  expectedCoolingStartTime: Date | null;
  assignedCoolingUnit: string;
  connectedDamper: string;
  damperPosition: number; // 0-100, % open
  airflowEstimate: number; // CFM
  scheduleStatus: ScheduleStatus | null;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  issueFlags: string[];
  temperatureHistory: { time: Date; value: number }[];
}

export interface Schedule {
  id: string;
  roomId: string;
  scheduleType: 'temporary' | 'permanent';
  activeDates: { start: Date; end: Date };
  activeTimes: { start: string; end: string };
  targetTemp: number;
  recurrenceDays: number[]; // 0-6, Sunday=0
  priorityLevel: 'low' | 'medium' | 'high';
  source: 'manual' | 'imported';
  createdAt: Date;
  status: ScheduleStatus;
}

export interface Issue {
  id: string;
  severity: Severity;
  category: 'equipment' | 'comfort' | 'efficiency' | 'maintenance' | 'airflow';
  title: string;
  description: string;
  relatedComponent: { type: 'room' | 'cooling-unit' | 'damper'; id: string };
  timestamp: Date;
  suggestedAction: string;
  status: 'open' | 'acknowledged' | 'resolved';
  source: 'AI detection' | 'maintenance rule' | 'threshold breach';
}

export interface MaintenanceEvent {
  id: string;
  componentId: string;
  componentType: 'cooling-unit' | 'damper';
  title: string;
  date: Date;
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  note: string;
}

// Real (or, for the mock-fallback path, mock-but-shaped-the-same) AI
// recommendation, sourced from the backend's optimizer per zone
// (backend/app/ml/optimizer.py) rather than a generic template. `isReal`
// gates whether "Apply" can do anything — the mock-fallback path has no
// backend to apply against, so its cards are informational only.
export interface LiveRecommendation {
  id: number;
  roomId: string;
  zoneName: string;
  action: string; // 'increase_airflow' | 'decrease_airflow' | 'maintain'
  reason: string;
  estimatedEnergyChange: number; // kWh, negative = savings
  comfortImpact: string | null; // 'improves' | 'neutral' | 'degrades'
  status: string; // 'pending' | 'applied'
  timestamp: string;
  isReal: boolean;
}

export interface KPIData {
  totalActiveRooms: number;
  totalRooms: number;
  coolingLoadPercentage: number;
  estimatedEnergySavings: number; // kWh
  averageComfortScore: number;
  openIssuesCount: number;
  predictedPeakDemandTime: Date;
  demandTrend: 'increasing' | 'decreasing' | 'low';
}

export interface TimeSeriesPoint {
  time: Date;
  utilization: number;
  efficiency: number;
  activatedZones: number;
  powerUsage: number;
}

export interface HVACSystemState {
  coolingUnits: CoolingUnit[];
  dampers: Damper[];
  rooms: Room[];
  schedules: Schedule[];
  issues: Issue[];
  maintenanceEvents: MaintenanceEvent[];
  recommendations: LiveRecommendation[];
  kpis: KPIData;
  utilizationHistory: TimeSeriesPoint[];
  lastUpdated: Date;
  aiOptimizationActive: boolean;
  simulationRunning: boolean;
  // 'mock-fallback' when the backend was unreachable and generateInitialHVACState()
  // was used instead — surfaced in the UI so a fully-plausible-looking
  // dashboard doesn't silently pass as real data.
  dataSource: 'live' | 'mock-fallback';
}
