"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Film,
  Image,
  Music,
  FileText,
  Trash2,
  MoreVertical,
  Search,
  Grid,
  List,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, formatDuration } from "@/lib/date";
import { toast } from "sonner";
import type { MediaAsset } from "@/lib/database.types";

interface LibraryContentProps {
  initialAssets: MediaAsset[];
}

const kindConfig = {
  video: { label: "Video", icon: Film, color: "bg-blue-500/20 text-blue-400" },
  image: { label: "Image", icon: Image, color: "bg-green-500/20 text-green-400" },
  audio: { label: "Audio", icon: Music, color: "bg-purple-500/20 text-purple-400" },
  srt: { label: "Subtitles", icon: FileText, color: "bg-yellow-500/20 text-yellow-400" },
  logo: { label: "Logo", icon: Image, color: "bg-pink-500/20 text-pink-400" },
};

export function LibraryContent({ initialAssets }: LibraryContentProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredAssets = assets.filter((asset) => {
    if (filter !== "all" && asset.kind !== filter) return false;
    if (search && !asset.filename.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        // Determine kind based on mime type
        let kind: MediaAsset["kind"] = "video";
        if (file.type.startsWith("image/")) {
          kind = "image";
        } else if (file.type.startsWith("audio/")) {
          kind = "audio";
        } else if (file.name.endsWith(".srt") || file.name.endsWith(".vtt")) {
          kind = "srt";
        }

        // Get presigned upload URL
        const urlRes = await fetch("/api/assets/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mime: file.type,
            kind,
          }),
        });

        if (!urlRes.ok) throw new Error("Failed to get upload URL");

        const { uploadUrl, objectKey } = await urlRes.json();

        // Upload to R2
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file");

        // Complete upload (save to DB)
        const completeRes = await fetch("/api/assets/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectKey,
            filename: file.name,
            mime: file.type,
            kind,
            sizeBytes: file.size,
          }),
        });

        if (!completeRes.ok) throw new Error("Failed to save asset");

        const { asset } = await completeRes.json();
        setAssets((prev) => [asset, ...prev]);
        toast.success(`Uploaded ${file.name}`);
      } catch (error) {
        console.error("Upload failed:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      toast.success("Asset deleted");
    } catch {
      toast.error("Failed to delete asset");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(1)} KB`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-background border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Media Library</h1>
            <p className="text-sm text-muted-foreground">
              {assets.length} asset{assets.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,image/*,audio/*,.srt,.vtt"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 px-6 pb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
              <TabsTrigger value="image">Image</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No assets found</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? "Try a different search term"
                : "Upload videos, images, and audio to get started"}
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAssets.map((asset) => {
              const config = kindConfig[asset.kind];
              const Icon = config.icon;

              return (
                <Card
                  key={asset.id}
                  className="group overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    {asset.thumbnail_url ? (
                      <img
                        src={asset.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className="w-8 h-8 text-muted-foreground/50" />
                    )}
                    <Badge
                      variant="secondary"
                      className={cn(
                        "absolute top-2 left-2 text-xs",
                        config.color
                      )}
                    >
                      {config.label}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(asset.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">
                      {asset.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(asset.size_bytes)}
                      {asset.duration_sec &&
                        ` • ${formatDuration(asset.duration_sec)}`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map((asset) => {
              const config = kindConfig[asset.kind];
              const Icon = config.icon;

              return (
                <div
                  key={asset.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="w-16 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                    {asset.thumbnail_url ? (
                      <img
                        src={asset.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <Icon className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {asset.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {formatDistanceToNow(asset.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0", config.color)}
                  >
                    {config.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {formatFileSize(asset.size_bytes)}
                  </span>
                  {asset.duration_sec && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formatDuration(asset.duration_sec)}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(asset.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

