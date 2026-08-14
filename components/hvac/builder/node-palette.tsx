"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { PALETTE_NODE_TYPES, type PaletteNodeType } from "./node-types";

function DraggableNode({ item }: { item: PaletteNodeType }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${item.type}`,
      data: {
        type: item.type,
        label: item.label,
      },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group flex items-center gap-3 rounded-lg border p-3 cursor-grab transition-all duration-200",
        item.color,
        isDragging
          ? "opacity-50 scale-95 cursor-grabbing"
          : "hover:scale-[1.02] hover:shadow-md"
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/50">
        <item.icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs opacity-70">{item.description}</p>
      </div>
      <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
}

export function NodePalette() {
  return (
    <div className="w-64 border-r border-border bg-card/50 p-4 flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Components</h3>
        <p className="text-xs text-muted-foreground">
          Drag to add to canvas
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-auto">
        {PALETTE_NODE_TYPES.map((item) => (
          <DraggableNode key={item.type} item={item} />
        ))}
      </div>
      <div className="mt-4 space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span> Connect
          nodes by dragging from one handle to another
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Keyboard:</span> Tab to a
          component, then Space or Enter to pick it up, arrow keys to move it over
          the canvas, Space or Enter to drop, Esc to cancel
        </p>
      </div>
    </div>
  );
}
