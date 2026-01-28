"use client";

import { useState, useEffect } from "react";
import { Search, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Clip {
  id: string;
  clip_link: string;
  description: string | null;
  tags: string[];
  duration_seconds: number;
  thumbnail_url: string | null;
  previewUrl?: string | null;
}

interface ClipLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (clipId: string, clipUrl: string, description: string) => void;
  minDuration?: number;
}

export function ClipLibraryModal({
  open,
  onClose,
  onSelect,
  minDuration,
}: ClipLibraryModalProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);

  // Fetch clips when modal opens
  useEffect(() => {
    if (open) {
      fetchClips();
    }
  }, [open]);

  const fetchClips = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (minDuration) params.set("minDuration", minDuration.toString());

      const res = await fetch(`/api/clips/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setClips(data.clips || []);
      }
    } catch (error) {
      console.error("Failed to fetch clips:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Search with debounce
  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(fetchClips, 300);
    return () => clearTimeout(timeout);
  }, [search, open]);

  const handleSelect = () => {
    if (!selectedClip) return;
    onSelect(
      selectedClip.id,
      selectedClip.clip_link,
      selectedClip.description || "B-roll footage"
    );
    setSelectedClip(null);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setSelectedClip(null); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose a Clip</DialogTitle>
          <DialogDescription>
            {minDuration 
              ? `Select a clip that is at least ${minDuration.toFixed(1)}s long`
              : "Select a clip from the library"}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clips by description or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Clips grid - fixed height */}
        <div className="flex-1 min-h-0 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : clips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "No matching clips found" : "No clips available"}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-1 pb-4">
              {clips.map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => setSelectedClip(clip)}
                  className={cn(
                    "text-left rounded-lg border overflow-hidden transition-all",
                    selectedClip?.id === clip.id
                      ? "ring-2 ring-primary border-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {clip.thumbnail_url ? (
                      <img
                        src={clip.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-medium line-clamp-2 mb-1">
                      {clip.description || "No description"}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {clip.duration_seconds}s
                      </Badge>
                      {clip.tags?.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {clip.tags.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - sticky at bottom */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-auto shrink-0 bg-background">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedClip}>
            Use Selected Clip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

