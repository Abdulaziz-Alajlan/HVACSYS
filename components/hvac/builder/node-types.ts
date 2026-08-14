// Single source of truth for the Builder's draggable equipment node types —
// icon, color, label, description. Previously node-palette.tsx (which needs
// label/description too) and app/builder/page.tsx (which only needs icon+color,
// keyed by type, for the DragOverlay preview) each hand-copied their own
// nodeIcons/nodeColors maps; this consolidates them so the two can't drift.
//
// Exports the icon as a component reference (not pre-sized JSX) since the
// palette list (h-4 w-4) and the drag-overlay preview (h-5 w-5) render it at
// different sizes.
import type { LucideIcon } from "lucide-react";
import { Wind, Snowflake, Flame, Fan, Building2, Gauge, Zap } from "lucide-react";

export interface PaletteNodeType {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const PALETTE_NODE_TYPES: PaletteNodeType[] = [
  {
    type: "ahu",
    label: "Air Handler",
    description: "AHU for air distribution",
    icon: Wind,
    color: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  },
  {
    type: "chiller",
    label: "Chiller",
    description: "Cooling equipment",
    icon: Snowflake,
    color: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  },
  {
    type: "boiler",
    label: "Boiler",
    description: "Heating equipment",
    icon: Flame,
    color: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  },
  {
    type: "vav",
    label: "VAV Box",
    description: "Variable air volume",
    icon: Fan,
    color: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  },
  {
    type: "zone",
    label: "Zone",
    description: "Room or area",
    icon: Building2,
    color: "bg-secondary text-foreground border-border",
  },
  {
    type: "sensor",
    label: "Sensor",
    description: "Temperature/humidity",
    icon: Gauge,
    color: "bg-chart-5/20 text-chart-5 border-chart-5/30",
  },
  {
    type: "pump",
    label: "Pump",
    description: "Water circulation",
    icon: Zap,
    color: "bg-primary/20 text-primary border-primary/30",
  },
];

export const nodeIcons: Record<string, LucideIcon> = Object.fromEntries(
  PALETTE_NODE_TYPES.map((n) => [n.type, n.icon])
);

export const nodeColors: Record<string, string> = Object.fromEntries(
  PALETTE_NODE_TYPES.map((n) => [n.type, n.color])
);
