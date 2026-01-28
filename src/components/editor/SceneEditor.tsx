"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Play,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEditorStore } from "@/lib/state/editorStore";
import { createEmptyTimeline } from "@/lib/timeline/v1";
import type { Project, MediaAsset, BrandPreset } from "@/lib/database.types";
import type { TimelineV1 } from "@/lib/timeline/v1";
import { ScenesList } from "./ScenesList";
import { PreviewPanel } from "./PreviewPanel";
import { InspectorPanel } from "./InspectorPanel";
import { toast } from "sonner";

interface SceneEditorProps {
  project: Project;
  assets: MediaAsset[];
  brandPresets: BrandPreset[];
}

export function SceneEditor({ project, assets, brandPresets }: SceneEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);

  const {
    setProject,
    timeline,
    isDirty,
    reset,
  } = useEditorStore();

  // Initialize editor state
  useEffect(() => {
    const initialTimeline = project.timeline_json
      ? (project.timeline_json as TimelineV1)
      : createEmptyTimeline({
          id: project.id,
          title: project.title,
          type: project.type,
          aspectRatio: project.aspect_ratio as "landscape" | "vertical" | "square",
        });

    setProject(project.id, initialTimeline);

    return () => {
      reset();
    };
  }, [project, setProject, reset]);

  const handleSave = async () => {
    if (!timeline) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline_json: timeline }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Changes saved");
      // Update original timeline to mark as clean
      setProject(project.id, timeline);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleRender = async () => {
    if (!timeline) return;

    // Save first if dirty
    if (isDirty()) {
      await handleSave();
    }

    setRendering(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/render`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to start render");

      toast.success("Render started! Redirecting to project view...");
      router.push(`/app/projects/${project.id}`);
    } catch {
      toast.error("Failed to start render");
    } finally {
      setRendering(false);
    }
  };

  const dirty = isDirty();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 h-14 border-b border-border bg-background flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (dirty && !confirm("You have unsaved changes. Discard them?")) {
                return;
              }
              router.push(`/app/projects/${project.id}`);
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{project.title}</h1>
              {dirty && (
                <Badge variant="secondary" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Unsaved
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeline?.scenes.length || 0} scene{(timeline?.scenes.length || 0) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
          <Button
            onClick={handleRender}
            disabled={rendering || !timeline?.scenes.length}
          >
            {rendering ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Render
          </Button>
        </div>
      </header>

      {/* Editor Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Scenes List */}
        <div className="w-72 border-r border-border bg-card shrink-0">
          <ScenesList assets={assets} />
        </div>

        {/* Center: Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <PreviewPanel assets={assets} />
        </div>

        {/* Right: Inspector */}
        <div className="w-80 border-l border-border bg-card shrink-0">
          <InspectorPanel assets={assets} brandPresets={brandPresets} />
        </div>
      </div>
    </div>
  );
}







