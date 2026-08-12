"use client";

import { useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  BackgroundVariant,
} from "@xyflow/react";
import type { NodeChange, EdgeChange, Connection } from "@xyflow/react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { nodeTypes } from "./custom-nodes";
import { useBuilderStore, type HVACEdge, type HVACNode, type RoomNodeData } from "@/lib/builder-store";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  Download,
  Sparkles,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

const proOptions = { hideAttribution: true };

export function BuilderCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange: storeOnNodesChange,
    onEdgesChange: storeOnEdgesChange,
    onConnect: storeOnConnect,
    simulationActive,
    toggleSimulation,
    resetLayout,
    selectedNodeId,
    setSelectedNode,
    aiOverlayEnabled,
    toggleAIOverlay,
    runAIOptimizeAll,
    applyAllRecommendations,
  } = useBuilderStore();

  const zoneRoomCount = nodes.filter((n) => n.data.type === "room" && (n.data as RoomNodeData).zoneId !== undefined).length;
  const pendingRecommendationCount = nodes.filter(
    (n) => n.data.type === "room" && (n.data as RoomNodeData).aiRecommendation?.status === "pending"
  ).length;

  // Per-room aiLoading already exists, but these batch buttons had no
  // feedback of their own — clicking "Optimize All" while it's still
  // running looked identical to it doing nothing.
  const [isOptimizingAll, setIsOptimizingAll] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  const handleOptimizeAll = async () => {
    setIsOptimizingAll(true);
    const run = runAIOptimizeAll();
    toast.promise(run, {
      loading: "Running AI Optimize...",
      success: "AI recommendations updated",
      error: "Failed to run AI Optimize",
    });
    await run;
    setIsOptimizingAll(false);
  };

  const handleApplyAll = async () => {
    setIsApplyingAll(true);
    const run = applyAllRecommendations();
    toast.promise(run, {
      loading: "Applying recommendations...",
      success: "Recommendations applied",
      error: "Failed to apply recommendations",
    });
    await run;
    setIsApplyingAll(false);
  };

  // Ensure all nodes have valid positions. No useMemo — the React Compiler
  // (enabled in next.config.mjs) handles memoization automatically.
  const validNodes = nodes.map((node, index) => {
    if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
      return {
        ...node,
        position: { x: 100 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 150 },
      };
    }
    return node;
  });

  const { setNodeRef, isOver } = useDroppable({
    id: "builder-canvas",
  });

  const handleNodesChange = (changes: NodeChange<HVACNode>[]) => {
    storeOnNodesChange(changes);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    storeOnEdgesChange(changes);
  };

  const handleConnect = (connection: Connection) => {
    storeOnConnect(connection);
    toast.success("Connection created");
  };

  const onNodeClick = (_: React.MouseEvent, node: HVACNode) => {
    setSelectedNode(node.id);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  const handleSave = () => {
    const data = { nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hvac-system.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("System configuration saved");
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        if (reactFlowWrapper.current === null && el) {
          (reactFlowWrapper as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
      }}
      className={cn(
        "flex-1 relative",
        isOver && "ring-2 ring-primary ring-inset"
      )}
    >
      <ReactFlow<HVACNode, HVACEdge>
        nodes={validNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          animated: simulationActive,
          style: { stroke: "hsl(var(--chart-1))", strokeWidth: 2 },
        }}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />
        
        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          className="!bg-card !border-border !shadow-lg"
        />

        <MiniMap
          nodeColor={(node) => {
            const colors: Record<string, string> = {
              ahu: "hsl(var(--chart-1))",
              chiller: "hsl(var(--chart-2))",
              boiler: "hsl(var(--chart-3))",
              vav: "hsl(var(--chart-4))",
              zone: "hsl(var(--secondary))",
              sensor: "hsl(var(--chart-5))",
              pump: "hsl(var(--primary))",
            };
            return colors[node.type || ""] || "hsl(var(--muted))";
          }}
          maskColor="hsl(var(--background) / 0.8)"
          className="!bg-card !border-border"
          pannable
          zoomable
        />

        {/* Top toolbar */}
        <Panel position="top-center" className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => zoomOut()}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => zoomIn()}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fitView({ padding: 0.2 })}
              className="h-8 w-8 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm">
            <Button
              variant={simulationActive ? "default" : "ghost"}
              size="sm"
              onClick={toggleSimulation}
              className={cn(
                "h-8 gap-1.5",
                simulationActive && "bg-accent hover:bg-accent/90 text-accent-foreground"
              )}
            >
              {simulationActive ? (
                <>
                  <Pause className="h-4 w-4" />
                  Running
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Simulate
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetLayout}
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm">
            <Button
              variant={aiOverlayEnabled ? "default" : "ghost"}
              size="sm"
              onClick={toggleAIOverlay}
              className={cn("h-8 gap-1.5", aiOverlayEnabled && "bg-primary hover:bg-primary/90")}
              title="Highlight rooms with a pending AI recommendation"
            >
              <Sparkles className="h-4 w-4" />
              AI Overlay
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              disabled={zoneRoomCount === 0 || isOptimizingAll}
              onClick={handleOptimizeAll}
            >
              {isOptimizingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Optimize All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              disabled={pendingRecommendationCount === 0 || isApplyingAll}
              onClick={handleApplyAll}
            >
              {isApplyingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Apply All
              {pendingRecommendationCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {pendingRecommendationCount}
                </Badge>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm">
            <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 gap-1.5">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </Panel>

        {/* Status bar */}
        <Panel position="bottom-left" className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
            <Badge variant="outline" className="text-xs">
              {validNodes.length} nodes
            </Badge>
            <Badge variant="outline" className="text-xs">
              {edges.length} connections
            </Badge>
            {simulationActive && (
              <Badge className="bg-accent/20 text-accent border-accent/30 text-xs animate-pulse">
                Simulating
              </Badge>
            )}
          </div>
        </Panel>

        {/* Selected node info */}
        {selectedNodeId && (
          <Panel position="bottom-right">
            <div className="rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm max-w-xs">
              <p className="text-xs text-muted-foreground mb-1">Selected</p>
              <p className="text-sm font-medium">
                {String(
                  validNodes.find((n) => n.id === selectedNodeId)?.data.name ||
                    validNodes.find((n) => n.id === selectedNodeId)?.data.label ||
                    selectedNodeId
                )}
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
