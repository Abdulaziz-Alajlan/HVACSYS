import type {
  CoolingUnit,
  Damper,
  Room,
  Schedule,
  Issue,
  MaintenanceEvent,
  LiveRecommendation,
  KPIData,
  TimeSeriesPoint,
  HVACSystemState,
  RoomType,
  CoolingStatus,
} from './hvac-types';

// Helper to generate random number in range
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// Generate time series for the past hours
function generateTimeSeriesHistory(hours: number, baseValue: number, variance: number): { time: Date; value: number }[] {
  const now = new Date();
  const points: { time: Date; value: number }[] = [];
  
  for (let i = hours * 12; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000); // 5-minute intervals
    const hourOfDay = time.getHours();
    
    // Add realistic daily pattern
    let multiplier = 1;
    if (hourOfDay >= 9 && hourOfDay <= 17) {
      multiplier = 1.2 + Math.sin((hourOfDay - 9) / 8 * Math.PI) * 0.3;
    } else if (hourOfDay < 6 || hourOfDay > 21) {
      multiplier = 0.4;
    } else {
      multiplier = 0.7;
    }
    
    const value = Math.min(100, Math.max(0, baseValue * multiplier + rand(-variance, variance)));
    points.push({ time, value });
  }
  
  return points;
}

// Generate cooling units
export function generateCoolingUnits(): CoolingUnit[] {
  const types: CoolingUnit['type'][] = ['AHU', 'FCU', 'Chiller', 'Split'];
  const units: CoolingUnit[] = [];
  
  const unitConfigs = [
    { name: 'CU-01', type: 'AHU' as const, zones: ['Zone A', 'Zone B'], utilBase: 75, effBase: 92 },
    { name: 'CU-02', type: 'AHU' as const, zones: ['Zone C', 'Zone D'], utilBase: 82, effBase: 78 }, // Low efficiency for alert
    { name: 'CU-03', type: 'Chiller' as const, zones: ['Zone E'], utilBase: 65, effBase: 95 },
    { name: 'CU-04', type: 'FCU' as const, zones: ['Zone F', 'Zone G'], utilBase: 88, effBase: 89 }, // High load
  ];
  
  unitConfigs.forEach((config, idx) => {
    const utilization = config.utilBase + rand(-5, 5);
    const efficiency = config.effBase + rand(-3, 3);
    const load = utilization * 0.95 + rand(-5, 5);
    const healthScore = efficiency > 85 ? randInt(85, 98) : randInt(60, 80);
    
    const maintenanceDue = new Date();
    maintenanceDue.setDate(maintenanceDue.getDate() + randInt(-5, 30));
    
    const maintenanceStatus = maintenanceDue < new Date() ? 'Overdue' : 
      maintenanceDue.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 ? 'Due soon' : 'Up to date';
    
    const warningFlags: string[] = [];
    if (efficiency < 80) warningFlags.push('Low efficiency detected');
    if (load > 85) warningFlags.push('High load warning');
    if (maintenanceStatus === 'Overdue') warningFlags.push('Maintenance overdue');
    
    units.push({
      id: `cu-${idx + 1}`,
      name: config.name,
      type: config.type,
      status: healthScore > 80 ? 'Healthy' : healthScore > 60 ? 'Attention Needed' : 'Degraded',
      utilization: Math.round(utilization),
      efficiency: Math.round(efficiency),
      load: Math.round(load),
      maxCapacity: randInt(50, 150),
      energyConsumption: Math.round(utilization * 0.8 + rand(10, 30)),
      zoneCoverage: config.zones,
      healthScore,
      maintenanceDueDate: maintenanceDue,
      maintenanceStatus,
      warningFlags,
      trendHistory: generateTimeSeriesHistory(24, utilization, 10),
    });
  });
  
  return units;
}

// Generate dampers
export function generateDampers(coolingUnits: CoolingUnit[]): Damper[] {
  const dampers: Damper[] = [];
  
  const damperConfigs = [
    { name: 'D-01', unit: 'cu-1', openness: 85, rooms: ['room-1', 'room-2'] },
    { name: 'D-02', unit: 'cu-1', openness: 72, rooms: ['room-3', 'room-4'] },
    { name: 'D-03', unit: 'cu-2', openness: 90, rooms: ['room-5', 'room-6'] },
    { name: 'D-04', unit: 'cu-2', openness: 45, rooms: ['room-7'] }, // Low openness
    { name: 'D-05', unit: 'cu-3', openness: 78, rooms: ['room-8', 'room-9'] },
    { name: 'D-06', unit: 'cu-4', openness: 65, rooms: ['room-10', 'room-11', 'room-12'] },
  ];
  
  damperConfigs.forEach((config, idx) => {
    const openness = config.openness + rand(-5, 5);
    const airflow = openness * 12 + rand(-50, 50); // CFM based on openness
    const healthScore = randInt(75, 98);
    
    const lastAdj = new Date();
    lastAdj.setMinutes(lastAdj.getMinutes() - randInt(5, 120));
    
    const actuatorStatus = healthScore > 85 ? 'Normal' : healthScore > 70 ? 'Slow Response' : 'Error';
    
    dampers.push({
      id: `damper-${idx + 1}`,
      name: config.name,
      openness: Math.round(openness),
      actuatorStatus,
      healthScore,
      airflowEstimate: Math.round(airflow),
      linkedCoolingUnit: config.unit,
      linkedRooms: config.rooms,
      lastAdjustmentTime: lastAdj,
      issueFlag: actuatorStatus !== 'Normal' ? `Actuator ${actuatorStatus.toLowerCase()}` : null,
      trendHistory: generateTimeSeriesHistory(12, openness, 8),
    });
  });
  
  return dampers;
}

// Generate rooms
function generateRooms(dampers: Damper[]): Room[] {
  const rooms: Room[] = [];
  const roomTypes: RoomType[] = ['office', 'meeting-room', 'lab', 'classroom', 'executive-office', 'server-room', 'lobby'];
  
  const roomConfigs: Array<{
    name: string;
    type: RoomType;
    damper: string;
    unit: string;
    capacity: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    scenario?: string;
  }> = [
    { name: 'A-101', type: 'office', damper: 'damper-1', unit: 'cu-1', capacity: 12, priority: 'medium' },
    { name: 'A-102', type: 'meeting-room', damper: 'damper-1', unit: 'cu-1', capacity: 20, priority: 'high', scenario: 'scheduled-soon' },
    { name: 'A-103', type: 'office', damper: 'damper-2', unit: 'cu-1', capacity: 8, priority: 'medium' },
    { name: 'A-104', type: 'executive-office', damper: 'damper-2', unit: 'cu-1', capacity: 4, priority: 'high' },
    { name: 'B-201', type: 'lab', damper: 'damper-3', unit: 'cu-2', capacity: 15, priority: 'critical' },
    { name: 'B-202', type: 'classroom', damper: 'damper-3', unit: 'cu-2', capacity: 30, priority: 'medium', scenario: 'high-occupancy' },
    { name: 'B-203', type: 'meeting-room', damper: 'damper-4', unit: 'cu-2', capacity: 10, priority: 'medium' },
    { name: 'C-301', type: 'server-room', damper: 'damper-5', unit: 'cu-3', capacity: 2, priority: 'critical' },
    { name: 'C-302', type: 'office', damper: 'damper-5', unit: 'cu-3', capacity: 16, priority: 'low' },
    { name: 'D-401', type: 'lobby', damper: 'damper-6', unit: 'cu-4', capacity: 50, priority: 'low' },
    { name: 'D-402', type: 'meeting-room', damper: 'damper-6', unit: 'cu-4', capacity: 8, priority: 'medium', scenario: 'inactive' },
    { name: 'D-403', type: 'office', damper: 'damper-6', unit: 'cu-4', capacity: 10, priority: 'medium' },
  ];
  
  const now = new Date();
  const currentHour = now.getHours();
  const isWorkingHours = currentHour >= 8 && currentHour <= 18;
  
  roomConfigs.forEach((config, idx) => {
    const damper = dampers.find(d => d.id === config.damper);
    const damperOpenness = damper?.openness ?? 50;
    
    let occupancy = 0;
    let currentTemp = 22 + rand(-2, 4);
    let targetTemp = 22;
    let coolingStatus: CoolingStatus = 'Inactive Cooling';
    let scheduleStatus: Schedule['status'] | null = null;
    let expectedStart: Date | null = null;
    
    // Apply scenarios
    if (config.scenario === 'scheduled-soon') {
      occupancy = 0;
      currentTemp = 24 + rand(0, 2);
      targetTemp = 21;
      coolingStatus = 'Starting in 10 Minutes';
      scheduleStatus = 'Upcoming';
      expectedStart = new Date(now.getTime() + 10 * 60 * 1000);
    } else if (config.scenario === 'high-occupancy') {
      occupancy = Math.floor(config.capacity * 0.9);
      currentTemp = 25 + rand(0, 2);
      targetTemp = 22;
      coolingStatus = 'Coolers Started';
      scheduleStatus = 'Active';
    } else if (config.scenario === 'inactive') {
      occupancy = 0;
      currentTemp = 23 + rand(-1, 1);
      coolingStatus = 'Inactive Cooling';
    } else if (config.type === 'server-room') {
      occupancy = randInt(0, 1);
      currentTemp = 19 + rand(-1, 2);
      targetTemp = 18;
      coolingStatus = 'Comfort Cooling';
      scheduleStatus = 'Recurring';
    } else if (isWorkingHours) {
      occupancy = randInt(Math.floor(config.capacity * 0.2), Math.floor(config.capacity * 0.8));
      currentTemp = 21 + rand(-1, 3);
      
      if (occupancy > config.capacity * 0.5) {
        coolingStatus = 'Comfort Cooling';
        scheduleStatus = 'Active';
      } else if (occupancy > 0) {
        coolingStatus = 'Expected to Start in a Bit';
      }
    }
    
    // Calculate comfort score based on temp deviation and occupancy
    const tempDeviation = Math.abs(currentTemp - targetTemp);
    let comfortScore = 100 - tempDeviation * 15 - (occupancy / config.capacity) * 10;
    comfortScore = Math.max(30, Math.min(100, comfortScore + rand(-5, 5)));
    
    // Calculate airflow based on damper openness
    const airflow = Math.round(damperOpenness * 10 + rand(-50, 50));
    
    // Issue flags
    const issueFlags: string[] = [];
    if (tempDeviation > 3) issueFlags.push('Temperature deviation');
    if (occupancy > config.capacity * 0.9) issueFlags.push('Near capacity');
    if (airflow < 300 && config.type !== 'lobby') issueFlags.push('Low airflow');
    
    rooms.push({
      id: `room-${idx + 1}`,
      name: config.name,
      roomType: config.type,
      currentTemp: Math.round(currentTemp * 10) / 10,
      targetTemp,
      predictedTemp: Math.round((currentTemp + (targetTemp - currentTemp) * 0.3) * 10) / 10,
      occupancyCount: occupancy,
      capacity: config.capacity,
      comfortScore: Math.round(comfortScore),
      openDuration: randInt(0, 30),
      coolingStatus,
      expectedCoolingStartTime: expectedStart,
      assignedCoolingUnit: config.unit,
      connectedDamper: config.damper,
      damperPosition: Math.round(damperOpenness),
      airflowEstimate: airflow,
      scheduleStatus,
      priorityLevel: config.priority,
      issueFlags,
      temperatureHistory: generateTimeSeriesHistory(24, currentTemp, 2),
    });
  });
  
  return rooms;
}

// Generate schedules
export function generateSchedules(rooms: Room[]): Schedule[] {
  const schedules: Schedule[] = [];
  const now = new Date();
  
  // Add some active and upcoming schedules
  const scheduledRooms = rooms.filter(r => r.scheduleStatus);
  
  scheduledRooms.forEach((room, idx) => {
    const startTime = new Date(now);
    startTime.setHours(startTime.getHours() - randInt(0, 2));
    
    const endTime = new Date(now);
    endTime.setHours(endTime.getHours() + randInt(1, 4));
    
    schedules.push({
      id: `schedule-${idx + 1}`,
      roomId: room.id,
      scheduleType: room.scheduleStatus === 'Recurring' ? 'permanent' : 'temporary',
      activeDates: { start: startTime, end: endTime },
      activeTimes: { 
        start: `${String(startTime.getHours()).padStart(2, '0')}:00`,
        end: `${String(endTime.getHours()).padStart(2, '0')}:00`,
      },
      targetTemp: room.targetTemp,
      recurrenceDays: room.scheduleStatus === 'Recurring' ? [1, 2, 3, 4, 5] : [],
      priorityLevel: room.priorityLevel === 'critical' ? 'high' : room.priorityLevel as 'low' | 'medium' | 'high',
      source: 'imported',
      createdAt: new Date(now.getTime() - randInt(1, 7) * 24 * 60 * 60 * 1000),
      status: room.scheduleStatus || 'Active',
    });
  });
  
  return schedules;
}

// Generate issues
export function generateIssues(coolingUnits: CoolingUnit[], dampers: Damper[], rooms: Room[]): Issue[] {
  const issues: Issue[] = [];
  const now = new Date();
  
  // Check cooling units for issues
  coolingUnits.forEach(unit => {
    if (unit.efficiency < 80) {
      issues.push({
        id: `issue-cu-${unit.id}`,
        severity: unit.efficiency < 70 ? 'critical' : 'warning',
        category: 'efficiency',
        title: `${unit.name} operating below expected efficiency`,
        description: `Current efficiency at ${unit.efficiency}%, expected above 85%`,
        relatedComponent: { type: 'cooling-unit', id: unit.id },
        timestamp: new Date(now.getTime() - randInt(5, 60) * 60 * 1000),
        suggestedAction: 'Inspect filter condition and refrigerant levels',
        status: 'open',
        source: 'AI detection',
      });
    }
    if (unit.load > 85) {
      issues.push({
        id: `issue-load-${unit.id}`,
        severity: 'warning',
        category: 'equipment',
        title: `High load on ${unit.name}`,
        description: `Unit operating at ${unit.load}% load capacity`,
        relatedComponent: { type: 'cooling-unit', id: unit.id },
        timestamp: new Date(now.getTime() - randInt(10, 30) * 60 * 1000),
        suggestedAction: 'Consider load balancing across units',
        status: 'open',
        source: 'threshold breach',
      });
    }
  });
  
  // Check dampers for issues
  dampers.forEach(damper => {
    if (damper.actuatorStatus !== 'Normal') {
      issues.push({
        id: `issue-damper-${damper.id}`,
        severity: damper.actuatorStatus === 'Error' ? 'critical' : 'warning',
        category: 'airflow',
        title: `${damper.name} actuator ${damper.actuatorStatus.toLowerCase()}`,
        description: `Damper actuator showing ${damper.actuatorStatus} status`,
        relatedComponent: { type: 'damper', id: damper.id },
        timestamp: new Date(now.getTime() - randInt(15, 90) * 60 * 1000),
        suggestedAction: 'Schedule actuator inspection',
        status: 'open',
        source: 'AI detection',
      });
    }
  });
  
  // Check rooms for comfort issues
  rooms.forEach(room => {
    if (room.comfortScore < 60) {
      issues.push({
        id: `issue-comfort-${room.id}`,
        severity: room.comfortScore < 50 ? 'critical' : 'warning',
        category: 'comfort',
        title: `Comfort drop detected in ${room.name}`,
        description: `Comfort score at ${room.comfortScore}%, temperature deviation from target`,
        relatedComponent: { type: 'room', id: room.id },
        timestamp: new Date(now.getTime() - randInt(5, 45) * 60 * 1000),
        suggestedAction: 'Adjust damper openness or increase cooling',
        status: 'open',
        source: 'AI detection',
      });
    }
  });
  
  // Add some general issues
  issues.push({
    id: 'issue-imbalance-1',
    severity: 'info',
    category: 'airflow',
    title: 'Cooling imbalance detected across Zone C',
    description: 'Airflow distribution showing 15% variance between connected rooms',
    relatedComponent: { type: 'damper', id: 'damper-3' },
    timestamp: new Date(now.getTime() - randInt(30, 120) * 60 * 1000),
    suggestedAction: 'Review damper positions in Zone C',
    status: 'acknowledged',
    source: 'AI detection',
  });
  
  return issues;
}

// Generate maintenance events
export function generateMaintenanceEvents(coolingUnits: CoolingUnit[]): MaintenanceEvent[] {
  const events: MaintenanceEvent[] = [];
  const now = new Date();
  
  coolingUnits.forEach((unit, idx) => {
    const eventDate = new Date(unit.maintenanceDueDate);
    
    events.push({
      id: `maint-${idx + 1}`,
      componentId: unit.id,
      componentType: 'cooling-unit',
      title: `Filter replacement - ${unit.name}`,
      date: eventDate,
      status: eventDate < now ? 'overdue' : eventDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 ? 'scheduled' : 'scheduled',
      priority: eventDate < now ? 'high' : 'medium',
      note: 'Quarterly filter inspection and replacement',
    });
  });
  
  // Add a completed maintenance
  events.push({
    id: 'maint-completed-1',
    componentId: 'cu-3',
    componentType: 'cooling-unit',
    title: 'Compressor inspection - CU-03',
    date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    status: 'completed',
    priority: 'medium',
    note: 'Annual compressor performance check completed',
  });
  
  return events;
}

// Generate AI recommendations — mock-fallback path only. The live path uses
// bundleToRecommendation() in hvac-live-data.ts against real backend
// output; this produces LiveRecommendation-shaped placeholders (isReal:
// false, so Apply is disabled) from mock room data, so both paths render
// through the same component without a separate branch.
export function generateRecommendations(rooms: Room[]): LiveRecommendation[] {
  const now = new Date().toISOString();
  let nextId = -1;

  return rooms
    .map((room): LiveRecommendation | null => {
      const deviation = room.currentTemp - room.targetTemp;
      if (Math.abs(deviation) < 1) return null; // close enough to target, nothing to suggest

      const action = deviation > 0 ? 'increase_airflow' : 'decrease_airflow';
      return {
        id: nextId--,
        roomId: room.id,
        zoneName: room.name,
        action,
        reason: `${room.name} is ${Math.abs(deviation).toFixed(1)}°C ${deviation > 0 ? 'above' : 'below'} its ${room.targetTemp}°C target — ${action === 'increase_airflow' ? 'more' : 'less'} airflow would help it converge.`,
        estimatedEnergyChange: action === 'increase_airflow' ? rand(0.05, 0.3) : -rand(0.05, 0.2),
        comfortImpact: action === 'increase_airflow' ? 'improves' : 'neutral',
        status: 'pending',
        timestamp: now,
        isReal: false,
      };
    })
    .filter((r): r is LiveRecommendation => r !== null)
    .slice(0, 5);
}

// Calculate KPIs. `previous` carries forward fields that a live data refresh
// (see hvac-store.ts) computed from real backend data, so a mock simulation
// tick doesn't overwrite them with fresh random numbers.
function calculateKPIs(
  rooms: Room[],
  coolingUnits: CoolingUnit[],
  issues: Issue[],
  previous?: Pick<KPIData, 'estimatedEnergySavings' | 'predictedPeakDemandTime' | 'demandTrend'>
): KPIData {
  const activeRooms = rooms.filter(r => r.coolingStatus !== 'Inactive Cooling');
  const avgComfort = rooms.reduce((sum, r) => sum + r.comfortScore, 0) / rooms.length;
  const totalLoad = coolingUnits.reduce((sum, u) => sum + u.load, 0) / coolingUnits.length;

  const peakTime = new Date();
  peakTime.setHours(14, 0, 0, 0);

  return {
    totalActiveRooms: activeRooms.length,
    totalRooms: rooms.length,
    coolingLoadPercentage: Math.round(totalLoad),
    estimatedEnergySavings: previous?.estimatedEnergySavings ?? Math.round(rand(45, 85)),
    averageComfortScore: Math.round(avgComfort),
    openIssuesCount: issues.filter(i => i.status === 'open').length,
    predictedPeakDemandTime: previous?.predictedPeakDemandTime ?? peakTime,
    demandTrend: previous?.demandTrend ?? 'low',
  };
}

// Generate utilization history
export function generateUtilizationHistory(): TimeSeriesPoint[] {
  const now = new Date();
  const points: TimeSeriesPoint[] = [];
  
  for (let i = 24 * 12; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000);
    const hour = time.getHours();
    
    let baseUtil = 40;
    if (hour >= 9 && hour <= 17) {
      baseUtil = 60 + Math.sin((hour - 9) / 8 * Math.PI) * 25;
    } else if (hour < 6 || hour > 21) {
      baseUtil = 25;
    }
    
    points.push({
      time,
      utilization: Math.round(baseUtil + rand(-5, 5)),
      efficiency: Math.round(85 + rand(-8, 8)),
      activatedZones: randInt(3, 7),
      powerUsage: Math.round(baseUtil * 1.2 + rand(-10, 10)),
    });
  }
  
  return points;
}

// Main function to generate complete system state
export function generateInitialHVACState(): HVACSystemState {
  const coolingUnits = generateCoolingUnits();
  const dampers = generateDampers(coolingUnits);
  const rooms = generateRooms(dampers);
  const schedules = generateSchedules(rooms);
  const issues = generateIssues(coolingUnits, dampers, rooms);
  const maintenanceEvents = generateMaintenanceEvents(coolingUnits);
  const recommendations = generateRecommendations(rooms);
  const kpis = calculateKPIs(rooms, coolingUnits, issues);
  const utilizationHistory = generateUtilizationHistory();
  
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
    dataSource: 'mock-fallback',
  };
}

// Simulate small updates
export function simulateUpdate(state: HVACSystemState): HVACSystemState {
  const newState = { ...state };
  
  // Update room temperatures slightly
  newState.rooms = state.rooms.map(room => {
    const tempDelta = room.coolingStatus === 'Inactive Cooling' 
      ? rand(0, 0.1) 
      : rand(-0.2, 0);
    
    const newTemp = Math.max(18, Math.min(30, room.currentTemp + tempDelta));
    const newComfort = Math.max(30, Math.min(100, room.comfortScore + rand(-2, 2)));
    
    // Occasionally change occupancy during work hours
    let newOccupancy = room.occupancyCount;
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 18 && Math.random() > 0.7) {
      newOccupancy = Math.max(0, Math.min(room.capacity, room.occupancyCount + randInt(-2, 2)));
    }
    
    return {
      ...room,
      currentTemp: Math.round(newTemp * 10) / 10,
      comfortScore: Math.round(newComfort),
      occupancyCount: newOccupancy,
    };
  });
  
  // Update cooling unit utilization
  newState.coolingUnits = state.coolingUnits.map(unit => ({
    ...unit,
    utilization: Math.max(20, Math.min(100, unit.utilization + rand(-2, 2))),
    load: Math.max(20, Math.min(100, unit.load + rand(-2, 2))),
  }));
  
  // Update damper openness slightly when AI optimization is active
  if (state.aiOptimizationActive) {
    newState.dampers = state.dampers.map(damper => ({
      ...damper,
      openness: Math.max(10, Math.min(100, damper.openness + rand(-1, 1))),
      lastAdjustmentTime: Math.random() > 0.9 ? new Date() : damper.lastAdjustmentTime,
    }));
  }
  
  // Recalculate KPIs
  newState.kpis = calculateKPIs(newState.rooms, newState.coolingUnits, newState.issues, state.kpis);
  newState.lastUpdated = new Date();
  
  return newState;
}

// Export room type labels
export const roomTypeLabels: Record<RoomType, string> = {
  'office': 'Office',
  'meeting-room': 'Meeting Room',
  'lab': 'Laboratory',
  'hallway': 'Hallway',
  'classroom': 'Classroom',
  'executive-office': 'Executive Office',
  'server-room': 'Server Room',
  'lobby': 'Lobby',
};

// Export status colors
export const coolingStatusColors: Record<CoolingStatus, string> = {
  'Inactive Cooling': 'bg-muted text-muted-foreground',
  'Comfort Cooling': 'bg-accent/20 text-accent',
  'Expected to Start in a Bit': 'bg-warning/20 text-warning',
  'Coolers Started': 'bg-primary/20 text-primary',
  'Starting in 10 Minutes': 'bg-info/20 text-info',
};

export const severityColors: Record<string, string> = {
  'info': 'bg-primary/20 text-primary border-primary/30',
  'warning': 'bg-warning/20 text-warning border-warning/30',
  'critical': 'bg-destructive/20 text-destructive border-destructive/30',
};
