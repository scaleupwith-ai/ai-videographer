"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { TimelineData } from "@/app/(dashboard)/app/projects/[id]/edit/page";

interface EditorTimelineProps {
  timeline: TimelineData;
  selectedSceneIndex: number | null;
  currentTime: number;
  isPlaying: boolean;
  onSceneSelect: (index: number | null) => void;
  onTimeSeek: (time: number) => void;
  onPlayPause: () => void;
}

export function EditorTimeline({
  timeline,
  selectedSceneIndex,
  currentTime,
  isPlaying,
  onSceneSelect,
  onTimeSeek,
  onPlayPause,
}: EditorTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [loadedThumbnails, setLoadedThumbnails] = useState<Set<number>>(new Set());

  // Calculate total duration
  const totalDuration = useMemo(
    () => timeline.scenes.reduce((sum, s) => sum + s.durationSec, 0),
    [timeline.scenes]
  );

  // Calculate scene positions
  const scenePositions = useMemo(() => {
    const positions: { start: number; end: number; width: number }[] = [];
    let accum = 0;
    for (const scene of timeline.scenes) {
      const start = accum;
      const end = accum + scene.durationSec;
      const width = (scene.durationSec / totalDuration) * 100;
      positions.push({ start, end, width });
      accum = end;
    }
    return positions;
  }, [timeline.scenes, totalDuration]);

  // Playhead position
  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle timeline click for seeking
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const seekTime = percent * totalDuration;
    
    onTimeSeek(Math.max(0, Math.min(seekTime, totalDuration)));
  };

  // Build thumbnail URL for a scene
  const getThumbnailUrl = (scene: typeof timeline.scenes[0]) => {
    if (!scene.clipUrl) return null;
    
    // For R2/direct URLs, we can't easily generate thumbnails client-side
    // For now, use the video URL as a poster source or a proxy
    if (scene.clipUrl.includes("drive.google.com")) {
      // Google Drive preview URL
      const match = scene.clipUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
      }
    }
    
    // For other URLs, we'll use a video element to capture a frame
    return scene.clipUrl;
  };

  return (
    <div className="w-full bg-card border-t">
      {/* Timeline controls */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30">
        {/* Play/Pause button */}
        <button
          onClick={onPlayPause}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          {isPlaying ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Time display */}
        <div className="text-sm font-mono tabular-nums">
          <span className="text-foreground">{formatTime(currentTime)}</span>
          <span className="text-muted-foreground"> / {formatTime(totalDuration)}</span>
        </div>

        {/* Deselect button */}
        {selectedSceneIndex !== null && (
          <button
            onClick={() => onSceneSelect(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Deselect
          </button>
        )}
      </div>

      {/* Timeline track */}
      <div className="px-4 py-3">
        <div
          ref={timelineRef}
          className="relative h-20 bg-muted rounded-lg cursor-pointer overflow-hidden"
          onClick={handleTimelineClick}
        >
          {/* Scene blocks with video thumbnails */}
          <div className="absolute inset-0 flex">
            {timeline.scenes.map((scene, index) => {
              const position = scenePositions[index];
              const isSelected = selectedSceneIndex === index;
              const thumbnailUrl = getThumbnailUrl(scene);
              const isLoaded = loadedThumbnails.has(index);

              return (
                <div
                  key={scene.id}
                  className={cn(
                    "relative h-full transition-all cursor-pointer group overflow-hidden",
                    isSelected 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background z-10" 
                      : "hover:ring-1 hover:ring-primary/50",
                    index > 0 && "border-l-2 border-background"
                  )}
                  style={{ width: `${position.width}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSceneSelect(index);
                  }}
                >
                  {/* Video thumbnail */}
                  {thumbnailUrl && (
                    <>
                      {!isLoaded && (
                        <div className="absolute inset-0 bg-muted flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      <video
                        src={thumbnailUrl.includes("drive.google.com") ? undefined : `/api/proxy/video?url=${encodeURIComponent(thumbnailUrl)}`}
                        poster={thumbnailUrl.includes("drive.google.com") ? thumbnailUrl : undefined}
                        className={cn(
                          "absolute inset-0 w-full h-full object-cover",
                          !isLoaded && "opacity-0"
                        )}
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedData={() => {
                          setLoadedThumbnails(prev => new Set(prev).add(index));
                        }}
                        onError={() => {
                          // Mark as loaded even on error to remove loading state
                          setLoadedThumbnails(prev => new Set(prev).add(index));
                        }}
                      />
                    </>
                  )}

                  {/* Fallback if no thumbnail */}
                  {!thumbnailUrl && (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  
                  {/* Selection highlight */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Playhead line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-lg"
            style={{ left: `${playheadPosition}%` }}
          >
            {/* Playhead handle */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
