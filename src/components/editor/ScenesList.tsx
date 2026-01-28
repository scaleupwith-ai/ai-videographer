"use client";

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Film, Image, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/state/editorStore";
import { createScene } from "@/lib/timeline/v1";
import { formatDuration } from "@/lib/date";
import type { MediaAsset } from "@/lib/database.types";
import type { Scene } from "@/lib/timeline/v1";
import { v4 as uuid } from "uuid";

interface ScenesListProps {
  assets: MediaAsset[];
}

function SceneCard({ scene, asset, isSelected, onSelect, onDelete }: {
  scene: Scene;
  asset: MediaAsset | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-transparent hover:border-border hover:bg-muted/50",
        isDragging && "opacity-50"
      )}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <button
        className="mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Thumbnail */}
      <div className="w-16 h-10 rounded bg-muted shrink-0 flex items-center justify-center overflow-hidden">
        {asset?.thumbnail_url ? (
          <img
            src={asset.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground">
            {scene.kind === "video" ? (
              <Film className="w-4 h-4" />
            ) : (
              <Image className="w-4 h-4" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {scene.overlays?.title || asset?.filename || `Scene ${scene.id.slice(0, 4)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDuration(scene.durationSec)} • {scene.kind}
        </p>
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

export function ScenesList({ assets }: ScenesListProps) {
  const {
    timeline,
    selectedSceneId,
    selectScene,
    deleteSceneById,
    addNewScene,
    reorderScenesAction,
  } = useEditorStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const assetMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    assets.forEach((a) => map.set(a.id, a));
    return map;
  }, [assets]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && timeline) {
      const oldIndex = timeline.scenes.findIndex((s) => s.id === active.id);
      const newIndex = timeline.scenes.findIndex((s) => s.id === over.id);
      reorderScenesAction(oldIndex, newIndex);
    }
  };

  const handleAddScene = () => {
    const newScene = createScene({
      id: uuid(),
      assetId: null,
      kind: "video",
      durationSec: 5,
    });
    addNewScene(newScene);
  };

  if (!timeline) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Scenes</h2>
          <Button size="sm" variant="outline" onClick={handleAddScene}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Scenes List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {timeline.scenes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No scenes yet</p>
              <p className="text-xs">Click Add to create a scene</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={timeline.scenes.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {timeline.scenes.map((scene) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      asset={scene.assetId ? assetMap.get(scene.assetId) : undefined}
                      isSelected={selectedSceneId === scene.id}
                      onSelect={() => selectScene(scene.id)}
                      onDelete={() => deleteSceneById(scene.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}







