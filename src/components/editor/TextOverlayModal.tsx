"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TextOverlayModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (text: string | null, x: number, y: number, style: TextStyle) => void;
  initialText?: string | null;
  initialX?: number;
  initialY?: number;
  initialStyle?: TextStyle;
  sceneDuration?: number;
}

export interface TextStyle {
  color: string;
  fontSize: number; // percentage of video height (1-10)
  fontFamily: string;
  duration: number; // seconds to show, 0 = whole scene
}

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier" },
  { value: "Impact", label: "Impact" },
  { value: "Comic Sans MS", label: "Comic Sans" },
];

const COLOR_PRESETS = [
  "#FFFFFF", // White
  "#000000", // Black
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#00bbbd", // Brand accent
];

const DEFAULT_STYLE: TextStyle = {
  color: "#FFFFFF",
  fontSize: 5,
  fontFamily: "Inter",
  duration: 0,
};

export function TextOverlayModal({
  open,
  onClose,
  onApply,
  initialText,
  initialX = 50,
  initialY = 50,
  initialStyle,
  sceneDuration = 5,
}: TextOverlayModalProps) {
  const [text, setText] = useState(initialText || "");
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);
  const [style, setStyle] = useState<TextStyle>(initialStyle || DEFAULT_STYLE);
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setText(initialText || "");
      setX(initialX);
      setY(initialY);
      setStyle(initialStyle || DEFAULT_STYLE);
    }
  }, [open, initialText, initialX, initialY, initialStyle]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const newX = ((e.clientX - rect.left) / rect.width) * 100;
    const newY = ((e.clientY - rect.top) / rect.height) * 100;
    
    setX(Math.max(5, Math.min(95, newX)));
    setY(Math.max(5, Math.min(95, newY)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleApply = () => {
    onApply(
      text.trim() || null,
      Math.round(x),
      Math.round(y),
      style
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Text</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Text input */}
          <div className="space-y-2">
            <Label htmlFor="text">Text</Label>
            <Input
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your text..."
              className="text-lg"
            />
          </div>

          {/* Position preview */}
          <div className="space-y-2">
            <Label>Position (drag to move)</Label>
            <div
              ref={previewRef}
              className={cn(
                "relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden",
                isDragging ? "cursor-grabbing" : "cursor-default"
              )}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Grid lines for reference */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border border-dashed border-white/50" />
                ))}
              </div>

              {/* Draggable text preview */}
              {text && (
                <div
                  className={cn(
                    "absolute p-2 rounded cursor-grab select-none transition-shadow",
                    isDragging ? "cursor-grabbing shadow-lg ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/50"
                  )}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                    color: style.color,
                    fontSize: `${style.fontSize * 4}px`,
                    fontFamily: style.fontFamily,
                    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {text}
                </div>
              )}

              {/* Helper text when empty */}
              {!text && (
                <div className="absolute inset-0 flex items-center justify-center text-white/50">
                  Enter text above to preview
                </div>
              )}
            </div>

            {/* Position coordinates */}
            <div className="flex justify-center gap-4 text-xs text-muted-foreground">
              <span>X: {Math.round(x)}%</span>
              <span>Y: {Math.round(y)}%</span>
            </div>
          </div>

          {/* Styling options */}
          <div className="grid grid-cols-2 gap-4">
            {/* Font Family */}
            <div className="space-y-2">
              <Label>Font</Label>
              <Select
                value={style.fontFamily}
                onValueChange={(value) => setStyle({ ...style, fontFamily: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label>Size: {style.fontSize}</Label>
              <Slider
                value={[style.fontSize]}
                onValueChange={([value]) => setStyle({ ...style, fontSize: value })}
                min={1}
                max={10}
                step={1}
                className="mt-2"
              />
            </div>

            {/* Color */}
            <div className="space-y-2 col-span-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setStyle({ ...style, color })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                      style.color === color ? "border-primary ring-2 ring-primary/50" : "border-gray-300"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={style.color}
                  onChange={(e) => setStyle({ ...style, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2 col-span-2">
              <Label>
                Duration: {style.duration === 0 ? "Whole scene" : `${style.duration}s`}
              </Label>
              <Slider
                value={[style.duration]}
                onValueChange={([value]) => setStyle({ ...style, duration: value })}
                min={0}
                max={Math.ceil(sceneDuration)}
                step={0.5}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">
                0 = show for entire scene duration
              </p>
            </div>
          </div>

          {/* Quick position presets */}
          <div className="space-y-2">
            <Label>Quick Positions</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Top", x: 50, y: 15 },
                { label: "Center", x: 50, y: 50 },
                { label: "Bottom", x: 50, y: 85 },
                { label: "Top Left", x: 15, y: 15 },
                { label: "Top Right", x: 85, y: 15 },
                { label: "Bottom Left", x: 15, y: 85 },
                { label: "Bottom Right", x: 85, y: 85 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setX(preset.x);
                    setY(preset.y);
                  }}
                  className={cn(
                    "text-xs",
                    Math.abs(x - preset.x) < 5 && Math.abs(y - preset.y) < 5 && "ring-2 ring-primary"
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
