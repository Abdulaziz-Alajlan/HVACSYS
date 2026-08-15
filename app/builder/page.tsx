"use client";

import { useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { NodePalette } from "@/components/hvac/builder/node-palette";
import { BuilderCanvas } from "@/components/hvac/builder/builder-canvas";
import { PropertiesPanel } from "@/components/hvac/builder/properties-panel";
import { nodeIcons, nodeColors } from "@/components/hvac/builder/node-types";
import { useBuilderStore } from "@/lib/builder-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

function BuilderContent() {
  const [activeDrag, setActiveDrag] = useState<{ type: string; label: string } | null>(null);
  const addNode = useBuilderStore((s) => s.addNode);
  const syncZoneMapping = useBuilderStore((s) => s.syncZoneMapping);
  const setZoneSyncFailed = useBuilderStore((s) => s.setZoneSyncFailed);

  // Map room nodes whose name matches a real backend zone (and pull their
  // real current/target temp, occupancy, etc.), so AI Optimize/Apply/
  // scenario actions know which zone to call and the panel shows real
  // values, not the default layout's random mock data. The builder still
  // works as a freeform editor if the backend isn't reachable, but
  // zoneSyncFailed surfaces that in the toolbar rather than only console.error
  // — otherwise a user only discovers it node-by-node.
  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    api
      .getZones()
      .then((zones) => {
        if (cancelled) return;
        setZoneSyncFailed(false);
        return syncZoneMapping(zones).then(() => {
          if (cancelled) return;
          // Keeps zone-mapped rooms' temp/occupancy/comfort/status current
          // in the background — without this, the properties panel's own
          // displayed state could sit stale indefinitely between manual
          // AI Optimize clicks, on top of (not instead of) the
          // recommendation itself still being a point-in-time snapshot.
          // 30s comfortably beats live_simulator.py's 5-minute tick without
          // hammering the backend for 5 zones' worth of reading fetches.
          pollId = setInterval(() => {
            syncZoneMapping(useBuilderStore.getState().zones, { background: true });
          }, 30_000);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to sync builder zones with backend:', err);
        setZoneSyncFailed(true);
      });

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, [syncZoneMapping, setZoneSyncFailed]);

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
    }),
    // Palette items already get role="button"/tabIndex from dnd-kit's
    // useDraggable, but without this sensor registered, Space/Enter on a
    // focused item did nothing — this is the actual gap, not the ARIA
    // attributes. Space/Enter picks up, arrow keys move, Space/Enter drops,
    // Esc cancels (dnd-kit's default keyboard codes).
    useSensor(KeyboardSensor)
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
        <main className="flex-1 flex overflow-hidden" aria-label="HVAC system builder workspace">
          <NodePalette />
          <ReactFlowProvider>
            <BuilderCanvas />
          </ReactFlowProvider>
          <PropertiesPanel />
        </main>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDrag && (() => {
          const Icon = nodeIcons[activeDrag.type];
          return (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 shadow-xl",
                nodeColors[activeDrag.type]
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/50">
                {Icon && <Icon className="h-5 w-5" />}
              </div>
              <span className="text-sm font-medium">{activeDrag.label}</span>
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}

export default function BuilderPage() {
  return <BuilderContent />;
}
