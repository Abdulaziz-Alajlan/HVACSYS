'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from '@xyflow/react';
import { toast } from 'sonner';
import { api, type ApiScenario, type ApiZone } from './api';
import { computeComfortScore, computeIssueFlags, deriveCoolingStatus } from './zone-derived';

// Node data types
export interface CoolingUnitNodeData extends Record<string, unknown> {
  type: 'cooling-unit';
  name: string;
  unitType: 'AHU' | 'FCU' | 'Chiller' | 'Split';
  utilization: number;
  efficiency: number;
  load: number;
  healthScore: number;
  maxCapacity: number;
  status: 'Healthy' | 'Attention Needed' | 'Maintenance Due' | 'Degraded';
  maintenanceDue: Date;
  warningFlags: string[];
}

export interface DamperNodeData extends Record<string, unknown> {
  type: 'damper';
  name: string;
  openness: number;
  airflow: number;
  healthScore: number;
  actuatorStatus: 'Normal' | 'Slow Response' | 'Stuck' | 'Error';
  lastAdjustment: Date;
  warnings: string[];
}

export interface RoomAIRecommendation {
  id: number;
  action: string;
  reason: string;
  recommendedAirflow: number;
  estimatedEnergyChange: number;
  comfortImpact: string | null;
  status: string;
  // When this recommendation was generated — the panel doesn't auto-refresh,
  // so without this a recommendation from minutes ago (against room state
  // that's since moved on) looks identical to a fresh one, which reads as
  // "the AI is stuck" rather than "the room changed since you last asked."
  fetchedAt: string;
}

export interface RoomNodeData extends Record<string, unknown> {
  type: 'room';
  name: string;
  roomType: 'office' | 'meeting-room' | 'lab' | 'hallway' | 'classroom' | 'executive-office' | 'server-room' | 'lobby';
  currentTemp: number;
  targetTemp: number;
  occupancy: number;
  capacity: number;
  comfortScore: number;
  status: 'Inactive Cooling' | 'Comfort Cooling' | 'Expected to Start in a Bit' | 'Coolers Started' | 'Starting in 10 Minutes';
  airflow: number;
  issues: string[];
  // Real backend zone this node maps to, set by syncZoneMapping() matching
  // on name; undefined for freeform/user-added rooms with no backend zone —
  // AI Optimize/Apply/scenario actions are unavailable for those.
  zoneId?: number;
  aiLoading?: boolean;
  aiRecommendation?: RoomAIRecommendation | null;
}

export interface GenericBuilderNodeData {
  label: string;
  [key: string]: unknown;
}

export type HVACNodeData =
  | CoolingUnitNodeData
  | DamperNodeData
  | RoomNodeData
  | GenericBuilderNodeData;

export type HVACNode = Node<HVACNodeData>;
export type HVACEdge = Edge;

interface BuilderState {
  nodes: HVACNode[];
  edges: HVACEdge[];
  selectedNodeId: string | null;
  aiOverlayEnabled: boolean;
  simulationActive: boolean;
  isSyncing: boolean;

  // Actions
  onNodesChange: (changes: NodeChange<HVACNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (
    type: string,
    position: { x: number; y: number },
    metadata?: { label?: string }
  ) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  updateNodeData: (id: string, data: Partial<HVACNodeData>) => void;
  setSelectedNode: (id: string | null) => void;
  toggleAIOverlay: () => void;
  toggleSimulation: () => void;
  resetLayout: () => void;
  duplicateNode: (id: string) => void;
  randomizeMetadata: () => void;
  saveLayout: () => void;
  loadLayout: () => void;

  // Backend-integration actions (Day 4)
  syncZoneMapping: (zones: ApiZone[]) => Promise<void>;
  runAIOptimize: (nodeId: string) => Promise<void>;
  runAIOptimizeAll: () => Promise<void>;
  applyRecommendation: (nodeId: string) => Promise<void>;
  applyAllRecommendations: () => Promise<void>;
  triggerScenario: (nodeId: string, scenario: ApiScenario) => Promise<void>;
}

// Generate random metadata for nodes
const generateCoolingUnitData = (name: string): CoolingUnitNodeData => ({
  type: 'cooling-unit',
  name,
  unitType: (['AHU', 'FCU', 'Chiller', 'Split'] as const)[Math.floor(Math.random() * 4)],
  utilization: Math.floor(Math.random() * 40 + 50),
  efficiency: Math.floor(Math.random() * 25 + 70),
  load: Math.floor(Math.random() * 40 + 50),
  healthScore: Math.floor(Math.random() * 30 + 70),
  maxCapacity: Math.floor(Math.random() * 100 + 50),
  status: Math.random() > 0.8 ? 'Attention Needed' : 'Healthy',
  maintenanceDue: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
  warningFlags: Math.random() > 0.7 ? ['High load'] : [],
});

const generateDamperData = (name: string): DamperNodeData => ({
  type: 'damper',
  name,
  openness: Math.floor(Math.random() * 50 + 40),
  airflow: Math.floor(Math.random() * 600 + 400),
  healthScore: Math.floor(Math.random() * 20 + 80),
  actuatorStatus: Math.random() > 0.9 ? 'Slow Response' : 'Normal',
  lastAdjustment: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
  warnings: [],
});

const generateRoomData = (name: string): RoomNodeData => {
  const roomTypes: RoomNodeData['roomType'][] = ['office', 'meeting-room', 'lab', 'classroom', 'executive-office', 'server-room', 'lobby'];
  const statuses: RoomNodeData['status'][] = ['Inactive Cooling', 'Comfort Cooling', 'Expected to Start in a Bit', 'Coolers Started', 'Starting in 10 Minutes'];
  const currentTemp = Math.floor(Math.random() * 8 + 19);
  const targetTemp = Math.floor(Math.random() * 4 + 20);
  const capacity = Math.floor(Math.random() * 20 + 5);
  
  return {
    type: 'room',
    name,
    roomType: roomTypes[Math.floor(Math.random() * roomTypes.length)],
    currentTemp,
    targetTemp,
    occupancy: Math.floor(Math.random() * capacity),
    capacity,
    comfortScore: Math.max(40, 100 - Math.abs(currentTemp - targetTemp) * 15),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    airflow: Math.floor(Math.random() * 500 + 300),
    issues: Math.random() > 0.8 ? ['Temperature deviation'] : [],
  };
};

function createPaletteNodeData(type: string, label: string): HVACNodeData {
  switch (type) {
    case 'ahu':
      return {
        label,
        capacity: 2500,
        status: 'idle',
      };
    case 'chiller':
      return {
        label,
        capacity: 120,
        efficiency: 85,
        status: 'off',
      };
    case 'boiler':
      return {
        label,
        capacity: 50000,
        temperature: 180,
        status: 'standby',
      };
    case 'vav':
      return {
        label,
        zone: 'Zone A',
        damperPosition: 50,
        flowRate: 500,
      };
    case 'zone':
      return {
        label,
        currentTemp: 72,
        setpoint: 70,
        occupancy: 0,
        status: 'optimal',
      };
    case 'sensor':
      return {
        label,
        sensorType: 'temperature',
        value: 72,
        unit: 'F',
      };
    case 'pump':
      return {
        label,
        speed: 60,
        power: 4.5,
        status: 'running',
      };
    case 'coolingUnit':
      return generateCoolingUnitData(label);
    case 'damper':
      return generateDamperData(label);
    case 'room':
      return generateRoomData(label);
    default:
      return { label };
  }
}

// Initial demo layout
const initialNodes: HVACNode[] = [
  {
    id: 'cu-1',
    type: 'coolingUnit',
    position: { x: 100, y: 200 },
    data: generateCoolingUnitData('CU-01'),
  },
  {
    id: 'cu-2',
    type: 'coolingUnit',
    position: { x: 100, y: 450 },
    data: generateCoolingUnitData('CU-02'),
  },
  {
    id: 'd-1',
    type: 'damper',
    position: { x: 350, y: 150 },
    data: generateDamperData('D-01'),
  },
  {
    id: 'd-2',
    type: 'damper',
    position: { x: 350, y: 300 },
    data: generateDamperData('D-02'),
  },
  {
    id: 'd-3',
    type: 'damper',
    position: { x: 350, y: 450 },
    data: generateDamperData('D-03'),
  },
  {
    id: 'r-1',
    type: 'room',
    position: { x: 600, y: 80 },
    data: generateRoomData('A-101'),
  },
  {
    id: 'r-2',
    type: 'room',
    position: { x: 600, y: 230 },
    data: generateRoomData('A-102'),
  },
  {
    id: 'r-3',
    type: 'room',
    position: { x: 600, y: 380 },
    data: generateRoomData('B-201'),
  },
  {
    id: 'r-4',
    type: 'room',
    position: { x: 600, y: 530 },
    data: generateRoomData('B-202'),
  },
];

const initialEdges: HVACEdge[] = [
  {
    id: 'e-cu1-d1',
    source: 'cu-1',
    target: 'd-1',
    animated: true,
    style: { stroke: 'hsl(220 80% 65%)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(220 80% 65%)' },
  },
  {
    id: 'e-cu1-d2',
    source: 'cu-1',
    target: 'd-2',
    animated: true,
    style: { stroke: 'hsl(220 80% 65%)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(220 80% 65%)' },
  },
  {
    id: 'e-cu2-d3',
    source: 'cu-2',
    target: 'd-3',
    animated: true,
    style: { stroke: 'hsl(220 80% 65%)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(220 80% 65%)' },
  },
  {
    id: 'e-d1-r1',
    source: 'd-1',
    target: 'r-1',
    animated: true,
    style: { stroke: 'hsl(165 80% 55%)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(165 80% 55%)' },
  },
  {
    id: 'e-d2-r2',
    source: 'd-2',
    target: 'r-2',
    animated: true,
    style: { stroke: 'hsl(165 80% 55%)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(165 80% 55%)' },
  },
  {
    id: 'e-d2-r3',
    source: 'd-2',
    target: 'r-3',
    animated: true,
    style: { stroke: 'hsl(165 80% 55%)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(165 80% 55%)' },
  },
  {
    id: 'e-d3-r4',
    source: 'd-3',
    target: 'r-4',
    animated: true,
    style: { stroke: 'hsl(165 80% 55%)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(165 80% 55%)' },
  },
];

// Guards the per-node async actions below (runAIOptimize/applyRecommendation/
// triggerScenario) against overlapping requests for the same node — e.g.
// "Optimize All" running while the user also clicks the individual button
// for one of those same rooms. Without this, whichever request resolves
// last wins even if it was started first, silently overwriting a newer
// result with a stale one. Same version-counter pattern used in
// hvac-store.ts for initialize()/refreshData(), scoped per-node here since
// these are per-node operations rather than a single global fetch.
//
// Keyed by `${nodeId}:${action}` rather than just nodeId — the three
// action types share one node's aiLoading flag (so a single-room UI click
// can't race itself), but "Optimize All" and "Apply All" are separate
// toolbar buttons with independent loading state, so different actions on
// the same room CAN overlap. Keying only by nodeId meant a successful
// Apply could get silently discarded because a concurrent Optimize for the
// same room bumped the shared counter after it — the backend really did
// mutate the zone, but the UI never reflected it. Scoping by action keeps
// each action type's own race-guard independent.
const nodeFetchVersions = new Map<string, number>();

function bumpNodeVersion(key: string): number {
  const next = (nodeFetchVersions.get(key) ?? 0) + 1;
  nodeFetchVersions.set(key, next);
  return next;
}

function isCurrentNodeVersion(key: string, version: number): boolean {
  return nodeFetchVersions.get(key) === version;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
      aiOverlayEnabled: false,
      simulationActive: false,
      isSyncing: false,

      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes) as HVACNode[],
        });
      },

      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },

      onConnect: (connection) => {
        const newEdge: HVACEdge = {
          ...connection,
          id: `e-${connection.source}-${connection.target}`,
          animated: true,
          style: { stroke: 'hsl(220 80% 65%)', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(220 80% 65%)' },
        };
        set({
          edges: addEdge(newEdge, get().edges),
        });
      },

      addNode: (type, position, metadata) => {
        const nodes = get().nodes;
        const nextId = generateNodeId(type);
        const fallbackLabel = `${type.charAt(0).toUpperCase()}${type.slice(1)} ${nodes.filter((node) => node.type === type).length + 1}`;
        const label = metadata?.label || fallbackLabel;
        const newNode: HVACNode = {
          id: nextId,
          type,
          position,
          data: createPaletteNodeData(type, label),
        };

        set({
          nodes: [...nodes, newNode],
        });
      },

      deleteNode: (id) => {
        set({
          nodes: get().nodes.filter(n => n.id !== id),
          edges: get().edges.filter(e => e.source !== id && e.target !== id),
          selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
        });
      },

      deleteEdge: (id) => {
        set({
          edges: get().edges.filter(e => e.id !== id),
        });
      },

      updateNodeData: (id, data) => {
        set({
          nodes: get().nodes.map(n => 
            n.id === id ? { ...n, data: { ...n.data, ...data } as HVACNodeData } : n
          ),
        });
      },

      setSelectedNode: (id) => {
        set({ selectedNodeId: id });
      },

      toggleAIOverlay: () => {
        set({ aiOverlayEnabled: !get().aiOverlayEnabled });
      },

      toggleSimulation: () => {
        set({ simulationActive: !get().simulationActive });
      },

      resetLayout: () => {
        set({
          nodes: initialNodes,
          edges: initialEdges,
          selectedNodeId: null,
        });
      },

      duplicateNode: (id) => {
        const node = get().nodes.find((n) => n.id === id);
        if (!node) return;
        const label = typeof node.data.label === 'string' ? node.data.label : undefined;
        const name = typeof node.data.name === 'string' ? node.data.name : undefined;

        const duplicatedNode: HVACNode = {
          ...node,
          id: generateNodeId(node.type || 'node'),
          position: {
            x: node.position.x + 40,
            y: node.position.y + 40,
          },
          data: {
            ...node.data,
            ...(label ? { label: `${label} Copy` } : {}),
            ...(name ? { name: `${name} Copy` } : {}),
          } as HVACNodeData,
        };

        set({
          nodes: [...get().nodes, duplicatedNode],
          selectedNodeId: duplicatedNode.id,
        });
      },

      randomizeMetadata: () => {
        set({
          nodes: get().nodes.map(node => {
            const name = typeof node.data.name === 'string' ? node.data.name : 'Node';

            if (node.data.type === 'cooling-unit') {
              return { ...node, data: generateCoolingUnitData(name) };
            } else if (node.data.type === 'damper') {
              return { ...node, data: generateDamperData(name) };
            } else if (node.data.type === 'room') {
              return { ...node, data: generateRoomData(name) };
            }
            return node;
          }),
        });
      },

      saveLayout: () => {
        // Layout is auto-saved via persist middleware
        console.log('Layout saved');
      },

      loadLayout: () => {
        // Layout is auto-loaded via persist middleware
        console.log('Layout loaded');
      },

      syncZoneMapping: async (zones) => {
        // Also clears aiLoading: a request in flight when the page reloads
        // would otherwise leave a stuck spinner, since persist saves node
        // data (including aiLoading) to localStorage.
        //
        // Pulls each matched room's *real* currentTemp/targetTemp/occupancy/
        // airflow/comfortScore/roomType/status/issues from the backend, not
        // just zoneId — the default layout's room nodes start out with
        // random mock values (generateRoomData() randomizes all of these),
        // so without this the properties panel shows stale/fake values right
        // next to an AI recommendation reasoning about the real ones. Uses
        // the same derivation formulas as the dashboard (zone-derived.ts) so
        // the two surfaces can't drift apart the way targetTemp once did.
        set({ isSyncing: true });
        const roomNodes = get().nodes.filter((n) => n.data.type === 'room');
        try {
          await Promise.all(
            roomNodes.map(async (node) => {
              const roomData = node.data as RoomNodeData;
              const zone = zones.find((z) => z.name === roomData.name);
              if (!zone) {
                get().updateNodeData(node.id, { zoneId: undefined, aiLoading: false });
                return;
              }
              try {
                const readings = await api.getZoneReadings(zone.id, 1);
                const latest = readings[readings.length - 1];
                if (!latest) {
                  get().updateNodeData(node.id, { zoneId: zone.id, aiLoading: false });
                  return;
                }
                const comfortScore = computeComfortScore(
                  latest.temperature,
                  zone.target_temperature,
                  latest.occupancy,
                  zone.capacity
                );
                const issues = computeIssueFlags(
                  latest.temperature,
                  zone.target_temperature,
                  latest.occupancy,
                  zone.capacity,
                  latest.airflow,
                  zone.room_type
                );
                get().updateNodeData(node.id, {
                  zoneId: zone.id,
                  aiLoading: false,
                  roomType: zone.room_type as RoomNodeData['roomType'],
                  currentTemp: Math.round(latest.temperature * 10) / 10,
                  targetTemp: zone.target_temperature,
                  occupancy: latest.occupancy,
                  capacity: zone.capacity,
                  airflow: Math.round(latest.airflow),
                  comfortScore: Math.round(comfortScore),
                  status: deriveCoolingStatus(latest.damper_position, latest.occupancy),
                  issues,
                });
              } catch (err) {
                console.error(`Failed to sync live data for ${roomData.name}:`, err);
                get().updateNodeData(node.id, { zoneId: zone.id, aiLoading: false });
              }
            })
          );
        } finally {
          set({ isSyncing: false });
        }
      },

      runAIOptimize: async (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node || node.data.type !== 'room') return;
        const roomData = node.data as RoomNodeData;
        if (roomData.zoneId === undefined) {
          toast.error(`${roomData.name} has no matching backend zone`);
          return;
        }

        const version = bumpNodeVersion(`${nodeId}:optimize`);
        get().updateNodeData(nodeId, { aiLoading: true });
        try {
          const rec = await api.recommendZone(roomData.zoneId);
          if (!isCurrentNodeVersion(`${nodeId}:optimize`, version)) return; // superseded by a newer optimize request
          get().updateNodeData(nodeId, {
            aiLoading: false,
            aiRecommendation: {
              id: rec.id,
              action: rec.action,
              reason: rec.reason,
              recommendedAirflow: rec.recommended_airflow,
              estimatedEnergyChange: rec.estimated_energy_change,
              comfortImpact: rec.comfort_impact,
              status: rec.status,
              fetchedAt: new Date().toISOString(),
            },
          });
          toast.success(`AI recommendation ready for ${roomData.name}`);
        } catch (err) {
          if (!isCurrentNodeVersion(`${nodeId}:optimize`, version)) return;
          get().updateNodeData(nodeId, { aiLoading: false });
          toast.error(`Failed to get AI recommendation for ${roomData.name}`);
          console.error(err);
        }
      },

      runAIOptimizeAll: async () => {
        const roomNodeIds = get()
          .nodes.filter((n) => n.data.type === 'room' && (n.data as RoomNodeData).zoneId !== undefined)
          .map((n) => n.id);
        await Promise.all(roomNodeIds.map((id) => get().runAIOptimize(id)));
      },

      applyRecommendation: async (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node || node.data.type !== 'room') return;
        const roomData = node.data as RoomNodeData;
        if (roomData.zoneId === undefined || !roomData.aiRecommendation || roomData.aiRecommendation.status !== 'pending') {
          return;
        }

        const version = bumpNodeVersion(`${nodeId}:apply`);
        get().updateNodeData(nodeId, { aiLoading: true });
        try {
          const result = await api.applyRecommendation(roomData.aiRecommendation.id);
          if (!isCurrentNodeVersion(`${nodeId}:apply`, version)) return; // superseded by a newer apply request
          const reading = result.new_reading;
          // target/capacity/roomType are static per zone, so the existing
          // roomData values are still correct — only the reading changed.
          get().updateNodeData(nodeId, {
            aiLoading: false,
            currentTemp: reading.temperature,
            occupancy: reading.occupancy,
            airflow: reading.airflow,
            comfortScore: Math.round(
              computeComfortScore(reading.temperature, roomData.targetTemp, reading.occupancy, roomData.capacity)
            ),
            status: deriveCoolingStatus(reading.damper_position, reading.occupancy),
            issues: computeIssueFlags(
              reading.temperature,
              roomData.targetTemp,
              reading.occupancy,
              roomData.capacity,
              reading.airflow,
              roomData.roomType
            ),
            aiRecommendation: { ...roomData.aiRecommendation, status: 'applied' },
          });

          const upstreamEdge = get().edges.find((e) => e.target === nodeId);
          const damperNode = upstreamEdge
            ? get().nodes.find((n) => n.id === upstreamEdge.source && n.data.type === 'damper')
            : undefined;
          if (damperNode) {
            get().updateNodeData(damperNode.id, {
              openness: reading.damper_position,
              airflow: reading.airflow,
              lastAdjustment: new Date(),
            });
          }
          toast.success(`Applied AI recommendation to ${roomData.name}`);
        } catch (err) {
          if (!isCurrentNodeVersion(`${nodeId}:apply`, version)) return;
          get().updateNodeData(nodeId, { aiLoading: false });
          toast.error(`Failed to apply recommendation for ${roomData.name}`);
          console.error(err);
        }
      },

      applyAllRecommendations: async () => {
        const roomNodeIds = get()
          .nodes.filter((n) => n.data.type === 'room' && (n.data as RoomNodeData).aiRecommendation?.status === 'pending')
          .map((n) => n.id);
        await Promise.all(roomNodeIds.map((id) => get().applyRecommendation(id)));
      },

      triggerScenario: async (nodeId, scenario) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node || node.data.type !== 'room') return;
        const roomData = node.data as RoomNodeData;
        if (roomData.zoneId === undefined) {
          toast.error(`${roomData.name} has no matching backend zone`);
          return;
        }

        const version = bumpNodeVersion(`${nodeId}:scenario`);
        get().updateNodeData(nodeId, { aiLoading: true });
        try {
          const reading = await api.triggerScenario(roomData.zoneId, scenario);
          if (!isCurrentNodeVersion(`${nodeId}:scenario`, version)) return; // superseded by a newer scenario request
          get().updateNodeData(nodeId, {
            aiLoading: false,
            currentTemp: reading.temperature,
            occupancy: reading.occupancy,
            airflow: reading.airflow,
            comfortScore: Math.round(
              computeComfortScore(reading.temperature, roomData.targetTemp, reading.occupancy, roomData.capacity)
            ),
            status: deriveCoolingStatus(reading.damper_position, reading.occupancy),
            issues: computeIssueFlags(
              reading.temperature,
              roomData.targetTemp,
              reading.occupancy,
              roomData.capacity,
              reading.airflow,
              roomData.roomType
            ),
          });

          const upstreamEdge = get().edges.find((e) => e.target === nodeId);
          const damperNode = upstreamEdge
            ? get().nodes.find((n) => n.id === upstreamEdge.source && n.data.type === 'damper')
            : undefined;
          if (damperNode) {
            get().updateNodeData(damperNode.id, {
              openness: reading.damper_position,
              airflow: reading.airflow,
              lastAdjustment: new Date(),
            });
          }
          toast.success(`Injected ${scenario.replace(/_/g, ' ')} on ${roomData.name}`);
        } catch (err) {
          if (!isCurrentNodeVersion(`${nodeId}:scenario`, version)) return;
          get().updateNodeData(nodeId, { aiLoading: false });
          toast.error(`Failed to inject scenario on ${roomData.name}`);
          console.error(err);
        }
      },
    }),
    {
      name: 'hvac-builder-storage',
      version: 1,
      // Bump `version` whenever a field is added to RoomAIRecommendation or
      // similar derived-only data (zoneId/aiRecommendation/aiLoading) — this
      // is how the fetchedAt crash happened: a field added later than the
      // rest of its type, so old localStorage lacked it and an unguarded
      // read threw. Rather than patching each new field into migrate by
      // hand, blanket-clear the derived blob on any version bump — it's all
      // re-populated fresh by syncZoneMapping() on the next mount anyway, so
      // nothing meaningful is lost, and this is the one place to remember
      // instead of every render site.
      migrate: (persistedState, fromVersion) => {
        const state = persistedState as { nodes: HVACNode[]; edges: HVACEdge[]; aiOverlayEnabled: boolean };
        if (fromVersion < 1) {
          return {
            ...state,
            nodes: state.nodes.map((n) =>
              n.data?.type === 'room'
                ? { ...n, data: { ...n.data, aiRecommendation: null, aiLoading: false, zoneId: undefined } }
                : n
            ),
          };
        }
        return state;
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        aiOverlayEnabled: state.aiOverlayEnabled,
      }),
      // Merge persisted state with initial state, validating node positions
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<BuilderState> | undefined;
        
        // Validate and fix nodes - ensure all have valid positions
        const validatedNodes = (persisted?.nodes || currentState.nodes).map((node, index) => {
          // Ensure position exists and has valid x/y values
          if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
            return {
              ...node,
              position: { x: 100 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 150 },
            };
          }
          return node;
        });

        return {
          ...currentState,
          ...persisted,
          nodes: validatedNodes as HVACNode[],
          edges: persisted?.edges || currentState.edges,
        };
      },
    }
  )
);

// Counter for generating unique IDs
let nodeCounter = 100;

export function generateNodeId(type: string): string {
  nodeCounter++;
  return `${type}-${nodeCounter}`;
}

export function generateNodeName(type: 'cooling-unit' | 'damper' | 'room', existingNodes: HVACNode[]): string {
  const prefix = type === 'cooling-unit' ? 'CU' : type === 'damper' ? 'D' : 'R';
  const existingNames = existingNodes
    .filter(n => n.data.type === type)
    .map(n => n.data.name);
  
  let num = 1;
  while (existingNames.includes(`${prefix}-${String(num).padStart(2, '0')}`)) {
    num++;
  }
  
  return `${prefix}-${String(num).padStart(2, '0')}`;
}
