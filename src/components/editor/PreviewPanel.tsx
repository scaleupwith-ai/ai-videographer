"use client";

import { useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useEditorStore } from "@/lib/state/editorStore";
import { totalDurationSec, findSceneAtTime, getSceneStartTimes } from "@/lib/timeline/v1";
import { formatDuration } from "@/lib/date";
import type { MediaAsset } from "@/lib/database.types";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  assets: MediaAsset[];
}

export function PreviewPanel({ assets }: PreviewPanelProps) {
  const {
    timeline,
    selectedSceneId,
    currentTimeSec,
    isPlaying,
    setCurrentTime,
    setPlaying,
    selectScene,
  } = useEditorStore();

  const assetMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    assets.forEach((a) => map.set(a.id, a));
    return map;
  }, [assets]);

  const duration = timeline ? totalDurationSec(timeline) : 0;
  const currentScene = timeline ? findSceneAtTime(timeline, currentTimeSec) : null;

  // Get aspect ratio dimensions for preview
  const aspectRatioStyles = useMemo(() => {
    if (!timeline) return { paddingBottom: "56.25%" }; // 16:9 default
    
    const { aspectRatio } = timeline.project;
    switch (aspectRatio) {
      case "vertical":
        return { paddingBottom: "177.78%" }; // 9:16
      case "square":
        return { paddingBottom: "100%" }; // 1:1
      default:
        return { paddingBottom: "56.25%" }; // 16:9
    }
  }, [timeline]);

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
    
    // Select the scene at the new time
    if (timeline) {
      const scene = findSceneAtTime(timeline, value[0]);
      if (scene && scene.id !== selectedSceneId) {
        selectScene(scene.id);
      }
    }
  };

  const handlePrevScene = () => {
    if (!timeline || !selectedSceneId) return;
    
    const currentIndex = timeline.scenes.findIndex((s) => s.id === selectedSceneId);
    if (currentIndex > 0) {
      const prevScene = timeline.scenes[currentIndex - 1];
      selectScene(prevScene.id);
      const startTimes = getSceneStartTimes(timeline);
      setCurrentTime(startTimes.get(prevScene.id) || 0);
    }
  };

  const handleNextScene = () => {
    if (!timeline || !selectedSceneId) return;
    
    const currentIndex = timeline.scenes.findIndex((s) => s.id === selectedSceneId);
    if (currentIndex < timeline.scenes.length - 1) {
      const nextScene = timeline.scenes[currentIndex + 1];
      selectScene(nextScene.id);
      const startTimes = getSceneStartTimes(timeline);
      setCurrentTime(startTimes.get(nextScene.id) || 0);
    }
  };

  // Get current asset to display
  const currentAsset = currentScene?.assetId
    ? assetMap.get(currentScene.assetId)
    : undefined;

  return (
    <div className="flex-1 flex flex-col p-4 gap-4">
      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
        <div className="relative w-full max-w-3xl" style={aspectRatioStyles}>
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden">
            {currentScene ? (
              currentAsset?.public_url ? (
                currentScene.kind === "video" ? (
                  <video
                    src={currentAsset.public_url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={currentAsset.public_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="text-center text-muted-foreground">
                  <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No media assigned</p>
                  <p className="text-xs">Select a scene and assign media in the inspector</p>
                </div>
              )
            ) : (
              <div className="text-center text-muted-foreground">
                <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No scenes</p>
                <p className="text-xs">Add scenes to preview your video</p>
              </div>
            )}

            {/* Overlay Text Preview */}
            {currentScene?.overlays && (
              <div className={cn(
                "absolute left-0 right-0 p-4 text-center",
                currentScene.overlays.position === "center" && "top-1/2 -translate-y-1/2",
                currentScene.overlays.position === "top" && "top-8",
                currentScene.overlays.position === "bottom" && "bottom-8",
                currentScene.overlays.position === "lower_third" && "bottom-16",
                currentScene.overlays.position === "upper_third" && "top-16"
              )}>
                <div className={cn(
                  "inline-block px-4 py-2 rounded",
                  currentScene.overlays.stylePreset === "boxed" && "bg-black/70",
                  currentScene.overlays.stylePreset === "lower_third" && "bg-gradient-to-r from-primary/80 to-primary/60",
                  currentScene.overlays.stylePreset === "minimal" && ""
                )}>
                  {currentScene.overlays.title && (
                    <h2 className="text-white text-xl font-bold drop-shadow-lg">
                      {currentScene.overlays.title}
                    </h2>
                  )}
                  {currentScene.overlays.subtitle && (
                    <p className="text-white/90 text-sm mt-1 drop-shadow-lg">
                      {currentScene.overlays.subtitle}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="shrink-0 space-y-2">
        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-12">
            {formatDuration(currentTimeSec)}
          </span>
          <Slider
            value={[currentTimeSec]}
            max={duration || 1}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
          />
          <span className="text-xs font-mono text-muted-foreground w-12 text-right">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevScene}
            disabled={!timeline?.scenes.length}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            onClick={() => setPlaying(!isPlaying)}
            disabled={!timeline?.scenes.length}
            className="w-10 h-10"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextScene}
            disabled={!timeline?.scenes.length}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Scene indicators */}
        {timeline && timeline.scenes.length > 0 && (
          <div className="flex gap-1 px-12">
            {timeline.scenes.map((scene) => (
              <div
                key={scene.id}
                className={cn(
                  "h-1 rounded-full transition-colors cursor-pointer",
                  scene.id === currentScene?.id
                    ? "bg-primary"
                    : "bg-muted hover:bg-muted-foreground/50"
                )}
                style={{
                  flex: scene.durationSec,
                }}
                onClick={() => {
                  selectScene(scene.id);
                  const startTimes = getSceneStartTimes(timeline);
                  setCurrentTime(startTimes.get(scene.id) || 0);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

