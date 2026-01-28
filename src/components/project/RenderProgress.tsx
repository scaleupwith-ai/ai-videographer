"use client";

import { cn } from "@/lib/utils";
import { Loader2, Check, Circle, Upload, Film, Music, Wand2, Download } from "lucide-react";

interface RenderProgressProps {
  progress: number;
  currentStage?: string;
}

const stages = [
  { id: "preparing", label: "Preparing", icon: Circle, threshold: 0 },
  { id: "downloading", label: "Downloading Clips", icon: Download, threshold: 10 },
  { id: "processing", label: "Processing Video", icon: Film, threshold: 30 },
  { id: "audio", label: "Adding Audio", icon: Music, threshold: 60 },
  { id: "effects", label: "Applying Effects", icon: Wand2, threshold: 80 },
  { id: "uploading", label: "Uploading", icon: Upload, threshold: 95 },
];

export function RenderProgress({ progress, currentStage }: RenderProgressProps) {
  // Determine current stage based on progress
  const getCurrentStageIndex = () => {
    for (let i = stages.length - 1; i >= 0; i--) {
      if (progress >= stages[i].threshold) {
        return i;
      }
    }
    return 0;
  };

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Central spinner and status */}
        <div className="text-center mb-12">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                className="text-primary transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{Math.round(progress)}%</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Rendering Your Video</h2>
          <p className="text-muted-foreground">
            {stages[currentStageIndex]?.label || "Processing..."}
          </p>
        </div>

        {/* Progress path with landmarks */}
        <div className="relative">
          {/* Background path */}
          <div className="absolute top-6 left-6 right-6 h-1 bg-muted rounded-full" />
          
          {/* Progress fill */}
          <div 
            className="absolute top-6 left-6 h-1 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
            style={{ width: `calc(${Math.min(progress, 100)}% - 48px)` }}
          />

          {/* Stage markers */}
          <div className="relative flex justify-between">
            {stages.map((stage, index) => {
              const isCompleted = progress > stage.threshold || (index < stages.length - 1 && progress >= stages[index + 1]?.threshold);
              const isCurrent = currentStageIndex === index;
              const StageIcon = stage.icon;

              return (
                <div key={stage.id} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-background border-primary animate-pulse"
                          : "bg-muted border-muted-foreground/30"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <StageIcon className={cn(
                        "w-5 h-5",
                        isCurrent ? "text-primary" : "text-muted-foreground/50"
                      )} />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs text-center max-w-[80px]",
                      isCompleted || isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tips while waiting */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            💡 Tip: You can navigate away from this page. Your video will continue rendering in the background.
          </p>
        </div>
      </div>
    </div>
  );
}







