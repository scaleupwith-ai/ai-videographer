"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft, Play, Pause, Volume2, VolumeX, GripVertical, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { EditorTopBar } from "@/components/editor/EditorTopBar";
import { ClipLibraryModal } from "@/components/editor/ClipLibraryModal";
import { TextOverlayModal, TextStyle } from "@/components/editor/TextOverlayModal";
import { TrimModal } from "@/components/editor/TrimModal";
import type { TransitionPreset, AnimationPreset } from "@/lib/timeline/v1";

// Types
export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  startTime: number; // seconds from video start
  duration: number; // seconds to show (0 = whole video)
  style: TextStyle;
}

export interface TimelineScene {
  id: string;
  clipId?: string;
  clipUrl?: string;
  assetId?: string;
  isUserAsset?: boolean;
  intent?: string;
  clipDescription?: string;
  durationSec: number;
  inSec: number;
  outSec: number;
  transition?: TransitionPreset | null;
  transitionOut?: string | null;
  transitionDuration?: number;
  animation?: AnimationPreset;
}

export interface TimelineData {
  version: number;
  project: {
    id: string;
    title: string;
    aspectRatio: string;
    resolution: { width: number; height: number };
    fps: number;
  };
  scenes: TimelineScene[];
  textOverlays?: TextOverlay[];
  global: {
    music: { assetId: string | null; volume: number };
    voiceover: { assetId: string | null; volume: number };
    captions: { enabled: boolean };
    brand: { colors: { primary: string; text: string } };
  };
}

export type SelectedItemType = "scene" | "text" | null;

export interface SelectedItem {
  id: string;
  type: SelectedItemType;
  sceneIndex?: number;
  textIndex?: number;
}

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // Core state
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);

  // Selection state
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  // Modal states
  const [showClipLibrary, setShowClipLibrary] = useState(false);
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Dragging states
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState<number | null>(null);
  const [textDragStart, setTextDragStart] = useState<{ startTime: number; duration: number; x: number } | null>(null);
  const [isResizingText, setIsResizingText] = useState<number | null>(null);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Buffering state
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Project status
  const [projectStatus, setProjectStatus] = useState<string>("draft");

  // Calculate total duration
  const totalDuration = timeline?.scenes.reduce((sum, s) => sum + s.durationSec, 0) || 0;

  // Calculate scene start times
  const sceneStartTimes = timeline?.scenes.reduce<number[]>((acc, scene, i) => {
    if (i === 0) return [0];
    return [...acc, acc[i - 1] + timeline.scenes[i - 1].durationSec];
  }, []) || [];

  // Get current scene index based on playhead position
  const getCurrentSceneIndex = useCallback(() => {
    for (let i = sceneStartTimes.length - 1; i >= 0; i--) {
      if (currentTime >= sceneStartTimes[i]) return i;
    }
    return 0;
  }, [currentTime, sceneStartTimes]);

  const currentSceneIndex = getCurrentSceneIndex();
  const currentScene = timeline?.scenes[currentSceneIndex];

  // Fetch project timeline
  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      
      const data = await res.json();
      const status = data.project?.status || "draft";
      setProjectStatus(status);
      
      // Block editing if video is still rendering
      if (status === "rendering" || status === "pending") {
        setError("Video is still rendering. Please wait until it's finished before editing.");
        return;
      }
      
      if (data.project?.timeline_json) {
        const tl = data.project.timeline_json;
        // Ensure textOverlays exists
        if (!tl.textOverlays) tl.textOverlays = [];
        setTimeline(tl);
        
        // Fetch voiceover URL if exists
        if (tl.global?.voiceover?.assetId) {
          fetchVoiceoverUrl(tl.global.voiceover.assetId);
        }
      } else {
        setError("Project has no timeline");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVoiceoverUrl = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (res.ok) {
        const data = await res.json();
        setVoiceoverUrl(data.asset?.public_url || null);
      }
    } catch (err) {
      console.error("Failed to fetch voiceover:", err);
    }
  };

  // Playback controls
  useEffect(() => {
    if (isPlaying && !isDraggingPlayhead) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime(t => {
          const next = t + 0.1;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, totalDuration, isDraggingPlayhead]);

  // Sync video to current time
  useEffect(() => {
    if (!videoRef.current || !currentScene) return;
    
    const sceneStart = sceneStartTimes[currentSceneIndex] || 0;
    const timeInScene = currentTime - sceneStart;
    const videoTime = currentScene.inSec + timeInScene;
    
    if (Math.abs(videoRef.current.currentTime - videoTime) > 0.5) {
      videoRef.current.currentTime = videoTime;
    }
    
    if (isPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else if (!isPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [currentTime, currentScene, currentSceneIndex, sceneStartTimes, isPlaying]);

  // Sync audio to current time
  useEffect(() => {
    if (!audioRef.current || !voiceoverUrl) return;
    
    if (Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
      audioRef.current.currentTime = currentTime;
    }
    
    if (isPlaying && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else if (!isPlaying && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [currentTime, isPlaying, voiceoverUrl]);

  // Save timeline
  const saveTimeline = async (newTimeline: TimelineData) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline_json: newTimeline }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setTimeline(newTimeline);
    } catch {
      // Silent fail - user will see if changes didn't save
    } finally {
      setIsSaving(false);
    }
  };

  // Selection handlers
  const handleSelectScene = useCallback((sceneIndex: number) => {
    if (!timeline) return;
    const scene = timeline.scenes[sceneIndex];
    setSelectedItem({
      id: scene.id,
      type: "scene",
      sceneIndex,
    });
  }, [timeline]);

  const handleSelectText = useCallback((textIndex: number) => {
    if (!timeline?.textOverlays) return;
    const text = timeline.textOverlays[textIndex];
    setSelectedItem({
      id: text.id,
      type: "text",
      textIndex,
    });
  }, [timeline]);

  const handleDeselect = useCallback(() => {
    setSelectedItem(null);
  }, []);

  // Seek to time
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  }, [totalDuration]);

  // Playhead drag handlers
  const handlePlayheadDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    setIsPlaying(false);
  }, []);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const time = percent * totalDuration;

    if (isDraggingPlayhead) {
      handleSeek(time);
    }

    if (isDraggingText !== null && textDragStart && timeline?.textOverlays) {
      const deltaX = (e.clientX - textDragStart.x) / rect.width;
      const deltaTime = deltaX * totalDuration;
      const newStartTime = Math.max(0, Math.min(totalDuration - textDragStart.duration, textDragStart.startTime + deltaTime));
      
      const newOverlays = [...timeline.textOverlays];
      newOverlays[isDraggingText] = {
        ...newOverlays[isDraggingText],
        startTime: newStartTime,
      };
      setTimeline({ ...timeline, textOverlays: newOverlays });
    }

    if (isResizingText !== null && textDragStart && timeline?.textOverlays) {
      const deltaX = (e.clientX - textDragStart.x) / rect.width;
      const deltaTime = deltaX * totalDuration;
      const newDuration = Math.max(0.5, textDragStart.duration + deltaTime);
      
      const newOverlays = [...timeline.textOverlays];
      newOverlays[isResizingText] = {
        ...newOverlays[isResizingText],
        duration: newDuration,
      };
      setTimeline({ ...timeline, textOverlays: newOverlays });
    }
  }, [isDraggingPlayhead, isDraggingText, isResizingText, textDragStart, timeline, totalDuration, handleSeek]);

  const handleTimelineMouseUp = useCallback(() => {
    if (isDraggingPlayhead) {
      setIsDraggingPlayhead(false);
    }
    if ((isDraggingText !== null || isResizingText !== null) && timeline) {
      // Save the timeline after drag ends
      saveTimeline(timeline);
    }
    setIsDraggingText(null);
    setIsResizingText(null);
    setTextDragStart(null);
  }, [isDraggingPlayhead, isDraggingText, isResizingText, timeline]);

  const handleTextDragStart = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!timeline?.textOverlays) return;
    
    const text = timeline.textOverlays[index];
    setIsDraggingText(index);
    setTextDragStart({ startTime: text.startTime, duration: text.duration, x: e.clientX });
  }, [timeline]);

  const handleTextResizeStart = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!timeline?.textOverlays) return;
    
    const text = timeline.textOverlays[index];
    setIsResizingText(index);
    setTextDragStart({ startTime: text.startTime, duration: text.duration, x: e.clientX });
  }, [timeline]);

  // Scene manipulation
  const handleChangeClip = useCallback(() => {
    if (!selectedItem || selectedItem.type !== "scene") return;
    setShowClipLibrary(true);
  }, [selectedItem]);

  const handleClipSelected = useCallback((clipId: string, clipUrl: string, clipDescription: string) => {
    if (!timeline || !selectedItem || selectedItem.sceneIndex === undefined) return;
    
    const newScenes = [...timeline.scenes];
    newScenes[selectedItem.sceneIndex] = {
      ...newScenes[selectedItem.sceneIndex],
      clipId,
      clipUrl,
      clipDescription,
      isUserAsset: false,
    };
    
    saveTimeline({ ...timeline, scenes: newScenes });
    setShowClipLibrary(false);
  }, [timeline, selectedItem]);

  const handleTrimScene = useCallback(() => {
    if (!selectedItem || selectedItem.type !== "scene") return;
    setShowTrimModal(true);
  }, [selectedItem]);

  const handleTrimApply = useCallback((newDuration: number, inSec: number, outSec: number) => {
    if (!timeline || !selectedItem || selectedItem.sceneIndex === undefined) return;
    
    const newScenes = [...timeline.scenes];
    newScenes[selectedItem.sceneIndex] = {
      ...newScenes[selectedItem.sceneIndex],
      durationSec: newDuration,
      inSec,
      outSec,
    };
    
    saveTimeline({ ...timeline, scenes: newScenes });
    setShowTrimModal(false);
  }, [timeline, selectedItem]);

  const handleAddText = useCallback(() => {
    setEditingTextIndex(null);
    setShowTextOverlay(true);
  }, []);

  const handleEditText = useCallback((textIndex: number) => {
    setEditingTextIndex(textIndex);
    setShowTextOverlay(true);
  }, []);

  const handleTextApply = useCallback((text: string | null, x: number, y: number, style: TextStyle) => {
    if (!timeline) return;
    
    const textOverlays = [...(timeline.textOverlays || [])];
    
    if (editingTextIndex !== null && editingTextIndex < textOverlays.length) {
      // Edit existing
      if (text) {
        textOverlays[editingTextIndex] = {
          ...textOverlays[editingTextIndex],
          text,
          x,
          y,
          style,
        };
      } else {
        // Remove if text is null/empty
        textOverlays.splice(editingTextIndex, 1);
      }
    } else if (text) {
      // Add new
      textOverlays.push({
        id: `text-${Date.now()}`,
        text,
        x,
        y,
        startTime: currentTime,
        duration: style.duration,
        style,
      });
    }
    
    saveTimeline({ ...timeline, textOverlays });
    setShowTextOverlay(false);
    setEditingTextIndex(null);
  }, [timeline, editingTextIndex, currentTime]);

  const handleDeleteScene = useCallback(() => {
    if (!timeline || !selectedItem || selectedItem.sceneIndex === undefined) return;
    if (timeline.scenes.length <= 1) {
      toast.error("Cannot delete the only scene");
      return;
    }
    
    const newScenes = timeline.scenes.filter((_, i) => i !== selectedItem.sceneIndex);
    saveTimeline({ ...timeline, scenes: newScenes });
    setSelectedItem(null);
  }, [timeline, selectedItem]);

  const handleDeleteText = useCallback(() => {
    if (!timeline || !selectedItem || selectedItem.textIndex === undefined) return;
    
    const textOverlays = [...(timeline.textOverlays || [])];
    textOverlays.splice(selectedItem.textIndex, 1);
    saveTimeline({ ...timeline, textOverlays });
    setSelectedItem(null);
  }, [timeline, selectedItem]);

  const handleChangeTransition = useCallback((transition: TransitionPreset | null) => {
    if (!timeline || !selectedItem || selectedItem.sceneIndex === undefined) return;
    
    const newScenes = [...timeline.scenes];
    newScenes[selectedItem.sceneIndex] = {
      ...newScenes[selectedItem.sceneIndex],
      transition,
      // Also set legacy transitionOut for backward compatibility
      transitionOut: transition === "cut" ? null : transition,
    };
    
    saveTimeline({ ...timeline, scenes: newScenes });
  }, [timeline, selectedItem]);

  const handleChangeAnimation = useCallback((animation: AnimationPreset) => {
    if (!timeline || !selectedItem || selectedItem.sceneIndex === undefined) return;
    
    const newScenes = [...timeline.scenes];
    newScenes[selectedItem.sceneIndex] = {
      ...newScenes[selectedItem.sceneIndex],
      animation,
    };
    
    saveTimeline({ ...timeline, scenes: newScenes });
  }, [timeline, selectedItem]);

  const handleDuplicateScene = useCallback(() => {
    if (!timeline || !selectedItem || selectedItem.sceneIndex === undefined) return;
    
    const originalScene = timeline.scenes[selectedItem.sceneIndex];
    const duplicatedScene = {
      ...originalScene,
      id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    const newScenes = [...timeline.scenes];
    newScenes.splice(selectedItem.sceneIndex + 1, 0, duplicatedScene);
    
    saveTimeline({ ...timeline, scenes: newScenes });
    toast.success("Scene duplicated");
  }, [timeline, selectedItem]);

  const [isRendering, setIsRendering] = useState(false);

  const handleRender = async () => {
    setIsRendering(true);
    try {
      // Save timeline first if there are unsaved changes
      if (timeline) {
        await saveTimeline(timeline);
      }
      
      const res = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start render");
      }
      
      toast.success("Render started! Redirecting to project view...");
      router.push(`/app/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to render");
      setIsRendering(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get video source URL
  const getVideoSrc = (scene: TimelineScene | undefined) => {
    if (!scene?.clipUrl) return null;
    if (scene.clipUrl.includes("drive.google.com") || scene.clipUrl.includes("googleusercontent")) {
      return `/api/proxy/video?url=${encodeURIComponent(scene.clipUrl)}`;
    }
    return scene.clipUrl;
  };

  // Get selected scene
  const selectedScene = selectedItem?.type === "scene" && selectedItem.sceneIndex !== undefined
    ? timeline?.scenes[selectedItem.sceneIndex]
    : null;

  // Get visible text overlays at current time
  const visibleTextOverlays = timeline?.textOverlays?.filter(t => {
    if (t.duration === 0) return true; // Show whole video
    const endTime = t.startTime + t.duration;
    return currentTime >= t.startTime && currentTime <= endTime;
  }) || [];

  // Playhead position as percentage
  const playheadPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error || !timeline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-lg font-medium">{error || "No timeline found"}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Toolbar */}
      <EditorTopBar
        selectedItem={selectedItem}
        selectedScene={selectedScene}
        onChangeClip={handleChangeClip}
        onTrim={handleTrimScene}
        onAddText={handleAddText}
        onDelete={selectedItem?.type === "text" ? handleDeleteText : handleDeleteScene}
        onDuplicate={selectedItem?.type === "scene" ? handleDuplicateScene : undefined}
        onChangeTransition={handleChangeTransition}
        onChangeAnimation={handleChangeAnimation}
        onRender={handleRender}
        onBack={() => router.push(`/app/projects/${projectId}`)}
        isSaving={isSaving}
        isRendering={isRendering}
      />

      {/* Main Content: Preview */}
      <div 
        className="flex-1 min-h-0 flex items-center justify-center p-6 bg-black/90"
        onClick={handleDeselect}
      >
        <div 
          className="relative bg-black rounded-lg overflow-hidden shadow-2xl"
          style={{ 
            width: "100%", 
            maxWidth: "800px",
            aspectRatio: `${timeline.project.resolution.width} / ${timeline.project.resolution.height}` 
          }}
        >
          {/* Video */}
          {currentScene && getVideoSrc(currentScene) && (
            <video
              ref={videoRef}
              key={currentScene.clipUrl}
              src={getVideoSrc(currentScene)!}
              className="absolute inset-0 w-full h-full object-contain"
              muted={isMuted}
              playsInline
              onWaiting={() => {
                setIsBuffering(true);
                // Pause audio when video is buffering
                if (audioRef.current && !audioRef.current.paused) {
                  audioRef.current.pause();
                }
              }}
              onPlaying={() => {
                setIsBuffering(false);
                // Resume audio when video resumes
                if (audioRef.current && isPlaying && audioRef.current.paused) {
                  audioRef.current.play().catch(() => {});
                }
              }}
              onCanPlay={() => {
                setIsBuffering(false);
                // Resume audio when video can play
                if (audioRef.current && isPlaying && audioRef.current.paused) {
                  audioRef.current.play().catch(() => {});
                }
              }}
              onError={(e) => console.error("Video load error:", e.currentTarget.error)}
            />
          )}
          
          {/* No video placeholder */}
          {currentScene && !getVideoSrc(currentScene) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center">
                <Film className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No video clip assigned</p>
              </div>
            </div>
          )}
          
          {/* Buffering indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 rounded-full p-4">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            </div>
          )}

          {/* Voiceover Audio */}
          {voiceoverUrl && (
            <audio
              ref={audioRef}
              src={voiceoverUrl}
              muted={isMuted}
            />
          )}

          {/* Text overlays */}
          {visibleTextOverlays.map((overlay) => (
            <div
              key={overlay.id}
              className="absolute cursor-move select-none"
              style={{
                left: `${overlay.x}%`,
                top: `${overlay.y}%`,
                transform: "translate(-50%, -50%)",
                color: overlay.style.color,
                fontSize: `${overlay.style.fontSize * 6}px`,
                fontFamily: overlay.style.fontFamily,
                textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                const idx = timeline.textOverlays?.findIndex(t => t.id === overlay.id);
                if (idx !== undefined && idx >= 0) handleSelectText(idx);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const idx = timeline.textOverlays?.findIndex(t => t.id === overlay.id);
                if (idx !== undefined && idx >= 0) handleEditText(idx);
              }}
            >
              {overlay.text}
            </div>
          ))}
        </div>
      </div>

      {/* Multi-track Timeline */}
      <div className="shrink-0 bg-card border-t">
        {/* Playback controls */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="text-sm font-mono tabular-nums">
            <span className="text-foreground">{formatTime(currentTime)}</span>
            <span className="text-muted-foreground"> / {formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Timeline tracks */}
        <div 
          className="relative px-4 py-2 select-none"
          onMouseMove={handleTimelineMouseMove}
          onMouseUp={handleTimelineMouseUp}
          onMouseLeave={handleTimelineMouseUp}
        >
          {/* Track labels */}
          <div className="absolute left-0 top-0 bottom-0 w-20 flex flex-col justify-center gap-1 pl-4 text-xs text-muted-foreground z-10">
            <div className="h-12 flex items-center">Video</div>
            <div className="h-8 flex items-center">Audio</div>
            <div className="h-8 flex items-center">Text</div>
          </div>

          {/* Tracks container */}
          <div className="ml-20 relative" ref={timelineRef}>
            {/* Draggable Playhead */}
            <div
              className={`absolute top-0 bottom-0 w-1 bg-red-500 z-30 cursor-ew-resize ${
                isDraggingPlayhead ? "w-1.5" : ""
              }`}
              style={{ left: `calc(${playheadPercent}% - 2px)` }}
              onMouseDown={handlePlayheadDragStart}
            >
              {/* Playhead handle */}
              <div 
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full cursor-grab active:cursor-grabbing shadow-lg"
                onMouseDown={handlePlayheadDragStart}
              />
              {/* Playhead triangle */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>

            {/* Video track */}
            <div 
              className="h-12 bg-muted rounded flex mb-1 cursor-pointer overflow-hidden"
              onClick={(e) => {
                if (isDraggingPlayhead) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                handleSeek(percent * totalDuration);
              }}
            >
              {timeline.scenes.map((scene, index) => {
                const width = (scene.durationSec / totalDuration) * 100;
                const isSelected = selectedItem?.type === "scene" && selectedItem.sceneIndex === index;
                
                return (
                  <div
                    key={scene.id}
                    className={`h-full relative overflow-hidden transition-all ${
                      isSelected ? "ring-2 ring-primary ring-inset z-10" : ""
                    } ${index > 0 ? "border-l border-background" : ""}`}
                    style={{ width: `${width}%`, backgroundColor: `hsl(${(index * 50) % 360}, 50%, 40%)` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectScene(index);
                    }}
                  />
                );
              })}
            </div>

            {/* Audio track */}
            <div 
              className="h-8 bg-muted rounded mb-1 cursor-pointer"
              onClick={(e) => {
                if (isDraggingPlayhead) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                handleSeek(percent * totalDuration);
              }}
            >
              {voiceoverUrl && (
                <div className="h-full bg-green-600/50 rounded flex items-center px-2">
                  <Volume2 className="w-3 h-3 text-green-200" />
                  <span className="text-xs text-green-200 ml-1">Voiceover</span>
                </div>
              )}
            </div>

            {/* Text track */}
            <div 
              className="h-8 bg-muted rounded relative cursor-pointer"
              onClick={(e) => {
                if (isDraggingPlayhead) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                handleSeek(percent * totalDuration);
              }}
            >
              {timeline.textOverlays?.map((text, index) => {
                const startPercent = (text.startTime / totalDuration) * 100;
                const durationPercent = text.duration === 0 
                  ? 100 - startPercent 
                  : (text.duration / totalDuration) * 100;
                const isSelected = selectedItem?.type === "text" && selectedItem.textIndex === index;
                
                return (
                  <div
                    key={text.id}
                    className={`absolute top-1 bottom-1 bg-yellow-500/70 rounded text-xs flex items-center overflow-hidden group ${
                      isSelected ? "ring-2 ring-primary z-10" : ""
                    } ${isDraggingText === index || isResizingText === index ? "opacity-80" : ""}`}
                    style={{ 
                      left: `${startPercent}%`, 
                      width: `${Math.min(durationPercent, 100 - startPercent)}%`,
                      minWidth: "40px"
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectText(index);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleEditText(index);
                    }}
                  >
                    {/* Drag handle */}
                    <div 
                      className="w-4 h-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-yellow-600/50"
                      onMouseDown={(e) => handleTextDragStart(e, index)}
                    >
                      <GripVertical className="w-3 h-3 text-yellow-900" />
                    </div>
                    
                    {/* Text label */}
                    <span className="truncate text-yellow-900 flex-1 px-1">{text.text}</span>
                    
                    {/* Resize handle */}
                    <div 
                      className="w-2 h-full cursor-ew-resize hover:bg-yellow-600/50 opacity-0 group-hover:opacity-100"
                      onMouseDown={(e) => handleTextResizeStart(e, index)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ClipLibraryModal
        open={showClipLibrary}
        onClose={() => setShowClipLibrary(false)}
        onSelect={handleClipSelected}
        minDuration={selectedScene?.durationSec}
      />

      <TextOverlayModal
        open={showTextOverlay}
        onClose={() => { setShowTextOverlay(false); setEditingTextIndex(null); }}
        onApply={handleTextApply}
        initialText={editingTextIndex !== null ? timeline.textOverlays?.[editingTextIndex]?.text : undefined}
        initialX={editingTextIndex !== null ? timeline.textOverlays?.[editingTextIndex]?.x : 50}
        initialY={editingTextIndex !== null ? timeline.textOverlays?.[editingTextIndex]?.y : 50}
        initialStyle={editingTextIndex !== null ? timeline.textOverlays?.[editingTextIndex]?.style : undefined}
        sceneDuration={totalDuration}
      />

      <TrimModal
        open={showTrimModal}
        onClose={() => setShowTrimModal(false)}
        onApply={handleTrimApply}
        scene={selectedScene}
      />
    </div>
  );
}
