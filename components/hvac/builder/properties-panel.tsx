"use client";

import { useEffect, useState } from "react";
import { useBuilderStore, type RoomNodeData } from "@/lib/builder-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Settings2,
  Trash2,
  Copy,
  Wind,
  Snowflake,
  Flame,
  Fan,
  Building2,
  Gauge,
  Zap,
  Sparkles,
  Users,
  Lock,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RelativeTime } from "@/components/hvac/relative-time";

const nodeIcons: Record<string, React.ReactNode> = {
  ahu: <Wind className="h-4 w-4" />,
  chiller: <Snowflake className="h-4 w-4" />,
  boiler: <Flame className="h-4 w-4" />,
  vav: <Fan className="h-4 w-4" />,
  zone: <Building2 className="h-4 w-4" />,
  sensor: <Gauge className="h-4 w-4" />,
  pump: <Zap className="h-4 w-4" />,
};

const nodeColors: Record<string, string> = {
  ahu: "text-chart-1",
  chiller: "text-chart-2",
  boiler: "text-chart-3",
  vav: "text-chart-4",
  zone: "text-foreground",
  sensor: "text-chart-5",
  pump: "text-primary",
};

export function PropertiesPanel() {
  const {
    nodes,
    selectedNodeId,
    updateNodeData,
    deleteNode,
    duplicateNode,
    runAIOptimize,
    applyRecommendation,
    triggerScenario,
  } = useBuilderStore();
  const node = nodes.find((n) => n.id === selectedNodeId);
  const [localData, setLocalData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (node) {
      setLocalData(node.data as Record<string, unknown>);
    }
  }, [node]);

  const handleChange = (key: string, value: unknown) => {
    const nextKey =
      key === "displayName" ? (node?.type === "coolingUnit" || node?.type === "damper" || node?.type === "room" ? "name" : "label") : key;
    const newData = { ...localData, [nextKey]: value };
    setLocalData(newData);
    if (selectedNodeId) {
      updateNodeData(selectedNodeId, newData);
    }
  };

  const handleDelete = () => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
      toast.success("Node deleted");
    }
  };

  const handleDuplicate = () => {
    if (selectedNodeId) {
      duplicateNode(selectedNodeId);
      toast.success("Node duplicated");
    }
  };

  if (!node || !selectedNodeId) {
    return (
      <div className="w-72 border-l border-border bg-card/50 p-4 flex flex-col items-center justify-center text-center">
        <Settings2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          Select a component to view and edit its properties
        </p>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-border bg-card/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg bg-secondary",
              nodeColors[node.type || ""]
            )}
          >
            {nodeIcons[node.type || ""] || <Settings2 className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {String(localData.name || localData.label || "Untitled")}
            </p>
            <Badge variant="outline" className="text-xs capitalize">
              {node.type}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            className="flex-1"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Duplicate
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="flex-1"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Common properties */}
        <div className="space-y-3">
          <Label htmlFor="label" className="text-xs text-muted-foreground">
            Label
          </Label>
          <Input
            id="label"
            value={String(localData.name || localData.label || "")}
            onChange={(e) => handleChange("displayName", e.target.value)}
            className="h-9"
          />
        </div>

        <Separator />

        {/* Type-specific properties */}
        {node.type === "ahu" && (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Capacity (CFM)
              </Label>
              <Input
                type="number"
                value={String(localData.capacity || "")}
                onChange={(e) =>
                  handleChange("capacity", parseInt(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={String(localData.status || "idle")}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="standby">Standby</SelectItem>
                  <SelectItem value="fault">Fault</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === "chiller" && (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Capacity (tons)
              </Label>
              <Input
                type="number"
                value={String(localData.capacity || "")}
                onChange={(e) =>
                  handleChange("capacity", parseInt(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Efficiency: {Number(localData.efficiency) || 85}%
              </Label>
              <Slider
                value={[Number(localData.efficiency) || 85]}
                onValueChange={([v]) => handleChange("efficiency", v)}
                min={50}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={String(localData.status || "off")}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === "boiler" && (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Capacity (BTU)
              </Label>
              <Input
                type="number"
                value={String(localData.capacity || "")}
                onChange={(e) =>
                  handleChange("capacity", parseInt(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Temperature (°F)
              </Label>
              <Input
                type="number"
                value={String(localData.temperature || "")}
                onChange={(e) =>
                  handleChange("temperature", parseInt(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={String(localData.status || "standby")}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standby">Standby</SelectItem>
                  <SelectItem value="firing">Firing</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === "vav" && (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Zone</Label>
              <Input
                value={String(localData.zone || "")}
                onChange={(e) => handleChange("zone", e.target.value)}
                placeholder="e.g., Zone A"
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Damper Position: {Number(localData.damperPosition) || 50}%
              </Label>
              <Slider
                value={[Number(localData.damperPosition) || 50]}
                onValueChange={([v]) => handleChange("damperPosition", v)}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Flow Rate (CFM)
              </Label>
              <Input
                type="number"
                value={String(localData.flowRate || "")}
                onChange={(e) =>
                  handleChange("flowRate", parseInt(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
          </>
        )}

        {node.type === "zone" && (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Current Temp (°F)
              </Label>
              <Input
                type="number"
                value={String(localData.currentTemp || "")}
                onChange={(e) =>
                  handleChange("currentTemp", parseFloat(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Setpoint (°F)
              </Label>
              <Input
                type="number"
                value={String(localData.setpoint || "")}
                onChange={(e) =>
                  handleChange("setpoint", parseFloat(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Occupancy</Label>
              <Input
                type="number"
                value={String(localData.occupancy || "")}
                onChange={(e) =>
                  handleChange("occupancy", parseInt(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={String(localData.status || "optimal")}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optimal">Optimal</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cool">Cool</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {node.type === "room" && (() => {
          const roomData = node.data as RoomNodeData;
          const hasZone = roomData.zoneId !== undefined;
          const rec = roomData.aiRecommendation;
          const loading = Boolean(roomData.aiLoading);

          return (
            <>
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Current Temp (°C)</Label>
                <Input
                  type="number"
                  value={String(localData.currentTemp ?? "")}
                  onChange={(e) => handleChange("currentTemp", parseFloat(e.target.value) || 0)}
                  className="h-9"
                  disabled={hasZone}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Target Temp (°C)</Label>
                <Input
                  type="number"
                  value={String(localData.targetTemp ?? "")}
                  onChange={(e) => handleChange("targetTemp", parseFloat(e.target.value) || 0)}
                  className="h-9"
                  disabled={hasZone}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Occupancy</Label>
                <Input
                  type="number"
                  value={String(localData.occupancy ?? "")}
                  onChange={(e) => handleChange("occupancy", parseInt(e.target.value) || 0)}
                  className="h-9"
                  disabled={hasZone}
                />
              </div>

              <Separator />

              {!hasZone && (
                <p className="text-xs text-muted-foreground">
                  No matching backend zone for &quot;{roomData.name}&quot; — editing local values only.
                </p>
              )}

              {hasZone && selectedNodeId && (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => runAIOptimize(selectedNodeId)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    AI Optimize
                  </Button>

                  {rec && (
                    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {rec.action.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant={rec.status === "applied" ? "default" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {rec.status === "applied" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {rec.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Energy change</span>
                        <span className={rec.estimatedEnergyChange < 0 ? "text-success" : "text-foreground"}>
                          {rec.estimatedEnergyChange >= 0 ? "+" : ""}
                          {rec.estimatedEnergyChange.toFixed(3)} kWh
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Recommended <RelativeTime date={rec.fetchedAt} />
                        </span>
                      </div>
                      {rec.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => applyRecommendation(selectedNodeId)}
                            disabled={loading}
                          >
                            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                            Apply
                          </Button>
                          <p className="text-[10px] text-muted-foreground">
                            Room state doesn&apos;t auto-refresh here — if it&apos;s been a while, click AI Optimize
                            again before applying to make sure this still reflects the current state.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <Separator />

                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Inject Scenario
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => triggerScenario(selectedNodeId, "occupancy_surge")}
                      disabled={loading}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Occupancy Surge
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => triggerScenario(selectedNodeId, "hot_outdoor_period")}
                      disabled={loading}
                    >
                      <Flame className="h-3.5 w-3.5" />
                      Hot Outdoor Period
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => triggerScenario(selectedNodeId, "blocked_damper")}
                      disabled={loading}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Blocked Damper
                    </Button>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {node.type === "sensor" && (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Sensor Type
              </Label>
              <Select
                value={String(localData.type || "temperature")}
                onValueChange={(v) => handleChange("type", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temperature">Temperature</SelectItem>
                  <SelectItem value="humidity">Humidity</SelectItem>
                  <SelectItem value="co2">CO2</SelectItem>
                  <SelectItem value="pressure">Pressure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input
                type="number"
                value={String(localData.value || "")}
                onChange={(e) =>
                  handleChange("value", parseFloat(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Input
                value={String(localData.unit || "")}
                onChange={(e) => handleChange("unit", e.target.value)}
                placeholder="e.g., °F, %, ppm"
                className="h-9"
              />
            </div>
          </>
        )}

        {node.type === "pump" && (
          <>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Speed: {Number(localData.speed) || 0}%
              </Label>
              <Slider
                value={[Number(localData.speed) || 0]}
                onValueChange={([v]) => handleChange("speed", v)}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">
                Power (kW)
              </Label>
              <Input
                type="number"
                value={String(localData.power || "")}
                onChange={(e) =>
                  handleChange("power", parseFloat(e.target.value) || 0)
                }
                className="h-9"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={String(localData.status || "off")}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="fault">Fault</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Position info */}
      <div className="p-4 border-t border-border bg-secondary/30">
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            X: {Math.round(node.position.x)}
          </div>
          <div>
            Y: {Math.round(node.position.y)}
          </div>
        </div>
      </div>
    </div>
  );
}
