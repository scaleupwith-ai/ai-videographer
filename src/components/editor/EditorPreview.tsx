"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimelineData } from "@/app/(dashboard)/app/projects/[id]/edit/page";

interface EditorPreviewProps {
  timeline: TimelineData;
  currentTime: number;
  isPlaying: boolean;
  selectedSceneIndex: number | null;
  onTimeUpdate?: (time: number) => void;
}

type LoadState = "loading" | "loaded" | "error";

export function EditorPreview({
  timeline,
  currentTime,
  isPlaying,
  selectedSceneIndex,
  onTimeUpdate,
}: EditorPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // Calculate scene start times
  const sceneStartTimes: number[] = [];
  let accum = 0;
  for (const scene of timeline.scenes) {
    sceneStartTimes.push(accum);
    accum += scene.durationSec;
  }

  // Calculate which scene we're in based on currentTime
  useEffect(() => {
    for (let i = timeline.scenes.length - 1; i >= 0; i--) {
      if (currentTime >= sceneStartTimes[i]) {
        setCurrentSceneIndex(i);
        return;
      }
    }
    setCurrentSceneIndex(0);
  }, [currentTime, timeline.scenes.length, sceneStartTimes]);

  // Get current scene (prefer selected, fallback to playhead position)
  const displaySceneIndex = selectedSceneIndex ?? currentSceneIndex;
  const currentScene = timeline.scenes[displaySceneIndex];
  const clipUrl = currentScene?.clipUrl;

  // Build video source URL
  const videoSrc = clipUrl 
    ? (clipUrl.includes("drive.google.com") || clipUrl.includes("googleusercontent")
        ? `/api/proxy/video?url=${encodeURIComponent(clipUrl)}`
        : clipUrl)
    : null;

  // Handle video play/pause
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // Sync video time with timeline
  useEffect(() => {
    if (!videoRef.current || !currentScene) return;
    
    // Calculate time within current scene
    const sceneStart = sceneStartTimes[displaySceneIndex] || 0;
    const timeInScene = currentTime - sceneStart;
    const clampedTime = Math.max(0, Math.min(timeInScene, currentScene.durationSec));
    
    // Seek video to correct position
    if (Math.abs(videoRef.current.currentTime - (currentScene.inSec + clampedTime)) > 0.5) {
      videoRef.current.currentTime = currentScene.inSec + clampedTime;
    }
  }, [currentTime, displaySceneIndex, currentScene, sceneStartTimes]);

  // Report time updates back
  useEffect(() => {
    if (!videoRef.current || !onTimeUpdate) return;

    const handleTimeUpdate = () => {
      if (!videoRef.current || !currentScene) return;
      
      const sceneStart = sceneStartTimes[displaySceneIndex] || 0;
      const videoTime = videoRef.current.currentTime - currentScene.inSec;
      onTimeUpdate(sceneStart + videoTime);
    };

    videoRef.current.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      videoRef.current?.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [displaySceneIndex, currentScene, sceneStartTimes, onTimeUpdate]);

  // Handle video events
  const handleLoadStart = () => setLoadState("loading");
  const handleLoadedData = () => setLoadState("loaded");
  const handleError = () => setLoadState("error");
  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => setIsBuffering(false);
  const handleCanPlay = () => setIsBuffering(false);

  const handleRetry = () => {
    setLoadState("loading");
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  // Aspect ratio
  const { width, height } = timeline.project.resolution;
  const isLandscape = width >= height;

  return (
    <div 
      className={cn(
        "relative bg-black rounded-lg overflow-hidden shadow-2xl",
        isLandscape ? "w-full max-w-4xl" : "h-full max-h-[70vh]"
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Video element */}
      {videoSrc && (
        <video
          ref={videoRef}
          key={videoSrc} // Force remount when source changes
          src={videoSrc}
          className={cn(
            "absolute inset-0 w-full h-full object-contain",
            loadState === "loaded" ? "opacity-100" : "opacity-0"
          )}
          onLoadStart={handleLoadStart}
          onLoadedData={handleLoadedData}
          onError={handleError}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onCanPlay={handleCanPlay}
          muted
          playsInline
        />
      )}

      {/* Loading state */}
      {loadState === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      )}

      {/* Buffering spinner */}
      {isBuffering && loadState === "loaded" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-full p-4">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        </div>
      )}

      {/* Error state */}
      {loadState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
          <AlertCircle className="w-10 h-10 text-destructive mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            {clipUrl ? "Failed to load preview" : "No video clip assigned"}
          </p>
          {clipUrl && (
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Text overlays preview */}
      {currentScene?.overlays?.text && (
        <div 
          className="absolute pointer-events-none"
          style={{
            left: `${currentScene.overlays.x ?? 50}%`,
            top: `${currentScene.overlays.y ?? 50}%`,
            transform: "translate(-50%, -50%)",
            color: currentScene.overlays.style?.color ?? "#FFFFFF",
            fontSize: `${(currentScene.overlays.style?.fontSize ?? 5) * 6}px`,
            fontFamily: currentScene.overlays.style?.fontFamily ?? "Inter",
            textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
          }}
        >
          {currentScene.overlays.text}
        </div>
      )}
    </div>
  );
}
