"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useBuilderStore } from "@/lib/builder-store";
import {
  Wind,
  Thermometer,
  Snowflake,
  Flame,
  Fan,
  Building2,
  Gauge,
  Zap,
  CircleDot,
  Sparkles,
  Loader2,
} from "lucide-react";

// Base node wrapper with consistent styling
function NodeWrapper({
  children,
  selected,
  className,
  glowColor = "primary",
}: {
  children: React.ReactNode;
  selected?: boolean;
  className?: string;
  glowColor?: "primary" | "accent" | "warning" | "critical";
}) {
  const glowClasses = {
    primary: selected ? "glow-primary" : "",
    accent: selected ? "glow-accent" : "",
    warning: selected ? "glow-warning" : "",
    critical: selected ? "glow-critical" : "",
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 transition-all duration-200",
        selected && "border-primary ring-1 ring-primary/50",
        glowClasses[glowColor],
        className
      )}
    >
      {children}
    </div>
  );
}

// AHU Node - Air Handling Unit
export const AHUNode = memo(function AHUNode({
  data,
  selected,
}: NodeProps & { data: { label: string; capacity?: number; status?: string } }) {
  return (
    <NodeWrapper selected={selected} className="min-w-[180px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-chart-1 !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/20">
          <Wind className="h-5 w-5 text-chart-1" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.label || "AHU"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.capacity ? `${data.capacity} CFM` : "Air Handler"}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Status</span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full",
            data.status === "running"
              ? "bg-success/20 text-success"
              : data.status === "standby"
              ? "bg-warning/20 text-warning"
              : "bg-muted text-muted-foreground"
          )}
        >
          {data.status || "Idle"}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-chart-1 !border-background !w-3 !h-3"
      />
    </NodeWrapper>
  );
});

// Chiller Node
export const ChillerNode = memo(function ChillerNode({
  data,
  selected,
}: NodeProps & {
  data: { label: string; capacity?: number; efficiency?: number; status?: string };
}) {
  return (
    <NodeWrapper selected={selected} glowColor="accent" className="min-w-[180px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-chart-2 !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/20">
          <Snowflake className="h-5 w-5 text-chart-2" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.label || "Chiller"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.capacity ? `${data.capacity} tons` : "Cooling Unit"}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Efficiency</span>
          <p className="font-medium text-chart-2">
            {data.efficiency ? `${data.efficiency}%` : "N/A"}
          </p>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Status</span>
          <p
            className={cn(
              "font-medium",
              data.status === "running" ? "text-success" : "text-muted-foreground"
            )}
          >
            {data.status || "Off"}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-chart-2 !border-background !w-3 !h-3"
      />
    </NodeWrapper>
  );
});

// Boiler Node
export const BoilerNode = memo(function BoilerNode({
  data,
  selected,
}: NodeProps & {
  data: { label: string; capacity?: number; temperature?: number; status?: string };
}) {
  return (
    <NodeWrapper selected={selected} glowColor="warning" className="min-w-[180px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-chart-3 !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/20">
          <Flame className="h-5 w-5 text-chart-3" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.label || "Boiler"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.capacity ? `${data.capacity} BTU` : "Heating Unit"}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <div>
          <span className="text-muted-foreground">Temp</span>
          <p className="font-medium text-chart-3">
            {data.temperature ? `${data.temperature}°F` : "N/A"}
          </p>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full",
            data.status === "firing"
              ? "bg-chart-3/20 text-chart-3"
              : "bg-muted text-muted-foreground"
          )}
        >
          {data.status || "Standby"}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-chart-3 !border-background !w-3 !h-3"
      />
    </NodeWrapper>
  );
});

// VAV Box Node (Variable Air Volume)
export const VAVNode = memo(function VAVNode({
  data,
  selected,
}: NodeProps & {
  data: { label: string; zone?: string; damperPosition?: number; flowRate?: number };
}) {
  return (
    <NodeWrapper selected={selected} className="min-w-[160px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-chart-4 !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4/20">
          <Fan className="h-4 w-4 text-chart-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.label || "VAV Box"}
          </p>
          <p className="text-xs text-muted-foreground">{data.zone || "Zone"}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
        <div>
          <span className="text-muted-foreground">Damper</span>
          <p className="font-medium">
            {data.damperPosition !== undefined ? `${data.damperPosition}%` : "N/A"}
          </p>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Flow</span>
          <p className="font-medium">
            {data.flowRate ? `${data.flowRate} CFM` : "N/A"}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-chart-4 !border-background !w-3 !h-3"
      />
    </NodeWrapper>
  );
});

// Zone/Room Node
export const ZoneNode = memo(function ZoneNode({
  data,
  selected,
}: NodeProps & {
  data: {
    label: string;
    currentTemp?: number;
    setpoint?: number;
    occupancy?: number;
    status?: "optimal" | "warm" | "cool" | "critical";
  };
}) {
  const statusColors = {
    optimal: "bg-success/20 border-success/50",
    warm: "bg-warning/20 border-warning/50",
    cool: "bg-chart-1/20 border-chart-1/50",
    critical: "bg-destructive/20 border-destructive/50",
  };

  return (
    <NodeWrapper
      selected={selected}
      className={cn("min-w-[160px]", statusColors[data.status || "optimal"])}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-foreground !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Building2 className="h-4 w-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.label || "Zone"}
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Thermometer className="h-3 w-3" />
            <span>
              {data.currentTemp ? `${data.currentTemp}°F` : "N/A"}
              {data.setpoint && ` / ${data.setpoint}°F`}
            </span>
          </div>
        </div>
      </div>
      {data.occupancy !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <CircleDot className="h-3 w-3" />
          <span>{data.occupancy} occupants</span>
        </div>
      )}
    </NodeWrapper>
  );
});

// Sensor Node
export const SensorNode = memo(function SensorNode({
  data,
  selected,
}: NodeProps & {
  data: { label: string; type?: string; value?: number; unit?: string };
}) {
  return (
    <NodeWrapper selected={selected} className="min-w-[120px]">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-chart-5 !border-background !w-2.5 !h-2.5"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-chart-5/20">
          <Gauge className="h-4 w-4 text-chart-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {data.label || "Sensor"}
          </p>
          <p className="text-sm font-semibold text-chart-5">
            {data.value !== undefined ? `${data.value}${data.unit || ""}` : "N/A"}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-chart-5 !border-background !w-2.5 !h-2.5"
      />
    </NodeWrapper>
  );
});

// Pump Node
export const PumpNode = memo(function PumpNode({
  data,
  selected,
}: NodeProps & {
  data: { label: string; speed?: number; power?: number; status?: string };
}) {
  return (
    <NodeWrapper selected={selected} className="min-w-[140px]">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 transition-transform",
            data.status === "running" && "animate-spin"
          )}
          style={{ animationDuration: "3s" }}
        >
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {data.label || "Pump"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.speed !== undefined ? `${data.speed}% speed` : "Pump"}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary !border-background !w-3 !h-3"
      />
    </NodeWrapper>
  );
});

// Cooling Unit Node (AHU, FCU, Chiller, Split)
export const CoolingUnitNode = memo(function CoolingUnitNode({
  data,
  selected,
}: NodeProps & {
  data: {
    name: string;
    unitType?: string;
    utilization?: number;
    efficiency?: number;
    status?: string;
    healthScore?: number;
  };
}) {
  const statusColors: Record<string, string> = {
    Healthy: "bg-success/20 text-success",
    "Attention Needed": "bg-warning/20 text-warning",
    "Maintenance Due": "bg-chart-3/20 text-chart-3",
    Degraded: "bg-destructive/20 text-destructive",
  };

  return (
    <NodeWrapper selected={selected} glowColor="accent" className="min-w-[200px]">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-chart-2 !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/20">
          <Snowflake className="h-5 w-5 text-chart-2" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.name || "Cooling Unit"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.unitType || "AHU"}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Utilization</span>
          <p className="font-medium text-chart-2">
            {data.utilization !== undefined ? `${data.utilization}%` : "N/A"}
          </p>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Efficiency</span>
          <p className="font-medium text-chart-2">
            {data.efficiency !== undefined ? `${data.efficiency}%` : "N/A"}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Status</span>
        <span className={cn("px-2 py-0.5 rounded-full", statusColors[data.status || "Healthy"] || "bg-muted text-muted-foreground")}>
          {data.status || "Healthy"}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-chart-2 !border-background !w-3 !h-3"
      />
    </NodeWrapper>
  );
});

// Damper Node
export const DamperNode = memo(function DamperNode({
  data,
  selected,
}: NodeProps & {
  data: {
    name: string;
    openness?: number;
    airflow?: number;
    healthScore?: number;
    actuatorStatus?: string;
  };
}) {
  return (
    <NodeWrapper selected={selected} className="min-w-[160px]">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-chart-4 !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4/20">
          <Fan className="h-4 w-4 text-chart-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.name || "Damper"}
          </p>
          <p className="text-xs text-muted-foreground">VAV Damper</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
        <div>
          <span className="text-muted-foreground">Open</span>
          <p className="font-medium text-chart-4">
            {data.openness !== undefined ? `${data.openness}%` : "N/A"}
          </p>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Flow</span>
          <p className="font-medium">
            {data.airflow ? `${data.airflow} CFM` : "N/A"}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Actuator</span>
        <span className={cn(
          "px-2 py-0.5 rounded-full",
          data.actuatorStatus === "Normal" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
        )}>
          {data.actuatorStatus || "Normal"}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-chart-4 !border-background !w-3 !h-3"
      />
    </NodeWrapper>
  );
});

// Room Node
export const RoomNode = memo(function RoomNode({
  data,
  selected,
}: NodeProps & {
  data: {
    name: string;
    roomType?: string;
    currentTemp?: number;
    targetTemp?: number;
    occupancy?: number;
    capacity?: number;
    comfortScore?: number;
    status?: string;
    zoneId?: number;
    aiLoading?: boolean;
    aiRecommendation?: { status: string } | null;
  };
}) {
  const aiOverlayEnabled = useBuilderStore((s) => s.aiOverlayEnabled);
  const statusColors: Record<string, string> = {
    "Comfort Cooling": "bg-success/20 border-success/50",
    "Coolers Started": "bg-chart-2/20 border-chart-2/50",
    "Inactive Cooling": "bg-muted border-muted-foreground/30",
    "Expected to Start in a Bit": "bg-chart-1/20 border-chart-1/50",
    "Starting in 10 Minutes": "bg-warning/20 border-warning/50",
  };
  const hasPendingRecommendation = aiOverlayEnabled && data.aiRecommendation?.status === "pending";

  return (
    <NodeWrapper
      selected={selected}
      className={cn(
        "min-w-[180px]",
        statusColors[data.status || "Inactive Cooling"] || "bg-muted",
        hasPendingRecommendation && "ring-2 ring-primary glow-primary"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-foreground !border-background !w-3 !h-3"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <Building2 className="h-4 w-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
            {data.name || "Room"}
            {data.aiLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {hasPendingRecommendation && !data.aiLoading && (
              <Sparkles className="h-3 w-3 text-primary" />
            )}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {data.roomType?.replace("-", " ") || "Room"}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Thermometer className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">
            {data.currentTemp !== undefined ? `${data.currentTemp}°` : "N/A"}
          </span>
          <span className="text-muted-foreground">
            {data.targetTemp !== undefined ? `/ ${data.targetTemp}°` : ""}
          </span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Comfort</span>
          <p className={cn(
            "font-medium",
            (data.comfortScore || 0) >= 80 ? "text-success" : (data.comfortScore || 0) >= 60 ? "text-warning" : "text-destructive"
          )}>
            {data.comfortScore !== undefined ? `${data.comfortScore}%` : "N/A"}
          </p>
        </div>
      </div>
      {data.occupancy !== undefined && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <CircleDot className="h-3 w-3" />
            <span>{data.occupancy}/{data.capacity || "?"} occupants</span>
          </div>
        </div>
      )}
      <div className="mt-2 text-xs">
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs",
          statusColors[data.status || "Inactive Cooling"]?.replace("border-", "text-").split(" ")[0] || "bg-muted text-muted-foreground"
        )}>
          {data.status || "Inactive"}
        </span>
      </div>
    </NodeWrapper>
  );
});

// Node type registry
export const nodeTypes = {
  ahu: AHUNode,
  chiller: ChillerNode,
  boiler: BoilerNode,
  vav: VAVNode,
  zone: ZoneNode,
  sensor: SensorNode,
  pump: PumpNode,
  coolingUnit: CoolingUnitNode,
  damper: DamperNode,
  room: RoomNode,
};
