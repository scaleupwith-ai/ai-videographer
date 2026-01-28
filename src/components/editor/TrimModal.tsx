"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { TimelineScene } from "@/app/(dashboard)/app/projects/[id]/edit/page";

interface TrimModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (newDuration: number, inSec: number, outSec: number) => void;
  scene: TimelineScene | null;
}

export function TrimModal({
  open,
  onClose,
  onApply,
  scene,
}: TrimModalProps) {
  const [duration, setDuration] = useState(5);
  const [inPoint, setInPoint] = useState(0);

  // Reset when modal opens
  useEffect(() => {
    if (open && scene) {
      setDuration(scene.durationSec);
      setInPoint(scene.inSec || 0);
    }
  }, [open, scene]);

  const handleApply = () => {
    onApply(duration, inPoint, inPoint + duration);
  };

  if (!scene) return null;

  // Max duration based on the clip (assume max 60s for now)
  const maxDuration = 60;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trim / Adjust Duration</DialogTitle>
          <DialogDescription>
            Set the duration for this scene
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Duration slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Duration</Label>
              <span className="text-sm font-mono text-muted-foreground">
                {duration.toFixed(1)}s
              </span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={([val]) => setDuration(val)}
              min={0.5}
              max={maxDuration}
              step={0.5}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5s</span>
              <span>{maxDuration}s</span>
            </div>
          </div>

          {/* Manual input */}
          <div className="space-y-2">
            <Label htmlFor="duration-input">Exact duration (seconds)</Label>
            <Input
              id="duration-input"
              type="number"
              min={0.5}
              max={maxDuration}
              step={0.1}
              value={duration}
              onChange={(e) => setDuration(Math.max(0.5, Math.min(maxDuration, parseFloat(e.target.value) || 0.5)))}
            />
          </div>

          {/* In point (for advanced trimming) */}
          <div className="space-y-2">
            <Label htmlFor="in-point">Start from (seconds)</Label>
            <Input
              id="in-point"
              type="number"
              min={0}
              step={0.1}
              value={inPoint}
              onChange={(e) => setInPoint(Math.max(0, parseFloat(e.target.value) || 0))}
            />
            <p className="text-xs text-muted-foreground">
              Skip the first {inPoint}s of the clip
            </p>
          </div>

          {/* Summary */}
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm">
              <strong>Scene duration:</strong> {duration.toFixed(1)}s
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clip range: {inPoint.toFixed(1)}s → {(inPoint + duration).toFixed(1)}s
            </p>
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







