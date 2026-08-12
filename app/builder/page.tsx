"use client";

import { useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { NodePalette } from "@/components/hvac/builder/node-palette";
import { BuilderCanvas } from "@/components/hvac/builder/builder-canvas";
import { PropertiesPanel } from "@/components/hvac/builder/properties-panel";
import { useBuilderStore } from "@/lib/builder-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wind, Snowflake, Flame, Fan, Building2, Gauge, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nodeIcons: Record<string, React.ReactNode> = {
  ahu: <Wind className="h-5 w-5" />,
  chiller: <Snowflake className="h-5 w-5" />,
  boiler: <Flame className="h-5 w-5" />,
  vav: <Fan className="h-5 w-5" />,
  zone: <Building2 className="h-5 w-5" />,
  sensor: <Gauge className="h-5 w-5" />,
  pump: <Zap className="h-5 w-5" />,
};

const nodeColors: Record<string, string> = {
  ahu: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  chiller: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  boiler: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  vav: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  zone: "bg-secondary text-foreground border-border",
  sensor: "bg-chart-5/20 text-chart-5 border-chart-5/30",
  pump: "bg-primary/20 text-primary border-primary/30",
};

function BuilderContent() {
  const [activeDrag, setActiveDrag] = useState<{ type: string; label: string } | null>(null);
  const addNode = useBuilderStore((s) => s.addNode);
  const syncZoneMapping = useBuilderStore((s) => s.syncZoneMapping);

  // Map room nodes whose name matches a real backend zone, so AI Optimize/
  // Apply/scenario actions know which zone to call. Silently no-ops if the
  // backend isn't reachable — the builder still works as a freeform editor.
  useEffect(() => {
    api
      .getZones()
      .then((zones) => syncZoneMapping(zones.map((z) => ({ id: z.id, name: z.name }))))
      .catch((err) => console.error('Failed to sync builder zones with backend:', err));
  }, [syncZoneMapping]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { type: string; label: string } | undefined;
    if (data) {
      setActiveDrag(data);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      
      const data = event.active.data.current as { type: string; label: string } | undefined;
      if (!data) return;

      // Check if dropped on canvas
      if (event.over?.id === "builder-canvas") {
        // Calculate position relative to canvas
        const canvasRect = document.querySelector(".react-flow")?.getBoundingClientRect();
        if (canvasRect && event.active.rect.current.translated) {
          const x = event.active.rect.current.translated.left - canvasRect.left;
          const y = event.active.rect.current.translated.top - canvasRect.top;
          
          addNode(data.type, { x: Math.max(0, x), y: Math.max(0, y) }, {
            label: data.label,
          });
        }
      }
    },
    [addNode]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-sm font-semibold">HVAC System Builder</h1>
              <p className="text-xs text-muted-foreground">
                Design and simulate your HVAC topology
              </p>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          <NodePalette />
          <ReactFlowProvider>
            <BuilderCanvas />
          </ReactFlowProvider>
          <PropertiesPanel />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDrag && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 shadow-xl",
              nodeColors[activeDrag.type]
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/50">
              {nodeIcons[activeDrag.type]}
            </div>
            <span className="text-sm font-medium">{activeDrag.label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default function BuilderPage() {
  return <BuilderContent />;
}
