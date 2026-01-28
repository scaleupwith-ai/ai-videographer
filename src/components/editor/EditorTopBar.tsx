"use client";

import { 
  ArrowLeft, 
  Film, 
  Scissors, 
  Type, 
  Sparkles, 
  Trash2, 
  Play,
  Loader2,
  ChevronDown,
  Copy,
  Wand2,
  MoveHorizontal,
  ZoomIn,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { TransitionPreset, AnimationPreset } from "@/lib/timeline/v1";

// Transition presets with descriptions
const TRANSITION_PRESETS: { value: TransitionPreset | null; label: string; description: string }[] = [
  { value: "cut", label: "Cut", description: "Hard cut, no transition" },
  { value: "fade", label: "Fade", description: "Cross-dissolve fade" },
  { value: "slide", label: "Slide", description: "Slide transition" },
  { value: "wipe", label: "Wipe", description: "Wipe transition" },
];

// Animation presets with descriptions
const ANIMATION_PRESETS: { value: AnimationPreset; label: string; description: string; icon: typeof ZoomIn }[] = [
  { value: "none", label: "None", description: "Static, no animation", icon: MoveHorizontal },
  { value: "subtle_zoom", label: "Subtle Zoom", description: "Slow zoom in (Ken Burns)", icon: ZoomIn },
  { value: "pan_left", label: "Pan Left", description: "Pan from right to left", icon: ArrowLeftRight },
  { value: "pan_right", label: "Pan Right", description: "Pan from left to right", icon: ArrowLeftRight },
  { value: "punch_in", label: "Punch In", description: "Quick zoom punch effect", icon: ZoomIn },
];

// Scene type from the editor page
interface TimelineScene {
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

interface SelectedItem {
  id: string;
  type: "scene" | "text" | null;
  sceneIndex?: number;
  textIndex?: number;
}

interface EditorTopBarProps {
  selectedItem: SelectedItem | null;
  selectedScene: TimelineScene | null;
  onChangeClip: () => void;
  onTrim: () => void;
  onAddText: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onChangeTransition: (transition: TransitionPreset | null) => void;
  onChangeAnimation?: (animation: AnimationPreset) => void;
  onRender: () => void;
  onBack: () => void;
  isSaving: boolean;
  isRendering?: boolean;
}

export function EditorTopBar({
  selectedItem,
  selectedScene,
  onChangeClip,
  onTrim,
  onAddText,
  onDelete,
  onDuplicate,
  onChangeTransition,
  onChangeAnimation,
  onRender,
  onBack,
  isSaving,
  isRendering,
}: EditorTopBarProps) {
  const hasSceneSelection = selectedItem !== null && selectedItem.type === "scene";
  const hasTextSelection = selectedItem !== null && selectedItem.type === "text";

  // Get current values
  const currentTransition = selectedScene?.transition ?? "cut";
  const currentAnimation = selectedScene?.animation ?? "none";

  return (
    <header className="shrink-0 h-14 bg-card border-b flex items-center px-4 gap-2">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Separator orientation="vertical" className="h-8" />

      {/* Context-sensitive actions based on selection */}
      {hasSceneSelection && selectedScene ? (
        <>
          {/* Scene selected - show scene actions */}
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="mr-2 font-mono text-xs">
              Scene {(selectedItem.sceneIndex ?? 0) + 1}
            </Badge>

            {/* Change Clip */}
            <Button variant="outline" size="sm" onClick={onChangeClip}>
              <Film className="w-4 h-4 mr-2" />
              Change Clip
            </Button>

            {/* Trim */}
            <Button variant="outline" size="sm" onClick={onTrim}>
              <Scissors className="w-4 h-4 mr-2" />
              Trim
            </Button>

            {/* Transition dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Transition
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Transition Out</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TRANSITION_PRESETS.map((t) => (
                  <DropdownMenuItem 
                    key={t.label}
                    onClick={() => onChangeTransition(t.value)}
                    className="flex flex-col items-start"
                  >
                    <div className="flex items-center w-full">
                      <span>{t.label}</span>
                      {currentTransition === t.value && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Animation dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Wand2 className="w-4 h-4 mr-2" />
                  Animation
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Clip Animation</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ANIMATION_PRESETS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <DropdownMenuItem 
                      key={a.value}
                      onClick={() => onChangeAnimation?.(a.value)}
                      className="flex flex-col items-start"
                    >
                      <div className="flex items-center w-full">
                        <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span>{a.label}</span>
                        {currentAnimation === a.value && (
                          <span className="ml-auto text-primary">✓</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ml-6">{a.description}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-8 mx-1" />

            {/* Duplicate */}
            {onDuplicate && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onDuplicate}
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
            )}

            {/* Delete */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </>
      ) : hasTextSelection ? (
        <>
          {/* Text selected - show text actions */}
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="mr-2 bg-yellow-500/20 text-yellow-600">
              Text Overlay
            </Badge>

            <span className="text-sm text-muted-foreground px-2">
              Double-click to edit text
            </span>

            <Separator orientation="vertical" className="h-8 mx-1" />

            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* No selection - show general actions */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={onAddText}>
              <Type className="w-4 h-4 mr-2" />
              Add Text
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Click a scene in the timeline to edit it
            </span>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save indicator */}
      {isSaving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving...
        </div>
      )}

      {/* Render button */}
      <Button 
        onClick={onRender} 
        className="bg-primary hover:bg-primary/90"
        disabled={isRendering}
      >
        {isRendering ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Render Video
          </>
        )}
      </Button>
    </header>
  );
}
