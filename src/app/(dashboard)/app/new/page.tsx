"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  ArrowLeft,
  Upload,
  Loader2,
  X,
  Play,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";

interface UploadedVideo {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  assetId?: string;
  progress: number;
}

export default function NewVideoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [creating, setCreating] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const newVideos: UploadedVideo[] = Array.from(files)
      .filter((file) => file.type.startsWith("video/"))
      .map((file) => ({
        id: uuid(),
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
        progress: 0,
      }));

    if (newVideos.length === 0) {
      toast.error("Please select video files");
      return;
    }

    setVideos((prev) => [...prev, ...newVideos]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeVideo = (id: string) => {
    setVideos((prev) => {
      const video = prev.find((v) => v.id === id);
      if (video?.preview) {
        URL.revokeObjectURL(video.preview);
      }
      return prev.filter((v) => v.id !== id);
    });
  };

  const uploadVideo = async (video: UploadedVideo): Promise<string | null> => {
    try {
      // Get presigned upload URL
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: video.file.name,
          mime: video.file.type,
          kind: "video",
        }),
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, objectKey } = await urlRes.json();

      // Upload to R2/S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: video.file,
        headers: { "Content-Type": video.file.type },
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");

      // Complete upload (save to DB)
      const completeRes = await fetch("/api/assets/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          filename: video.file.name,
          mime: video.file.type,
          kind: "video",
          sizeBytes: video.file.size,
        }),
      });

      if (!completeRes.ok) throw new Error("Failed to save asset");
      const { asset } = await completeRes.json();

      return asset.id;
    } catch (error) {
      console.error("Upload failed:", error);
      return null;
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (videos.length === 0) {
      toast.error("Please upload at least one video");
      return;
    }

    setCreating(true);

    try {
      // Upload all videos first
      toast.info("Uploading videos...");
      const assetIds: string[] = [];

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        
        setVideos((prev) =>
          prev.map((v) =>
            v.id === video.id ? { ...v, uploading: true, progress: 0 } : v
          )
        );

        const assetId = await uploadVideo(video);
        
        if (assetId) {
          assetIds.push(assetId);
          setVideos((prev) =>
            prev.map((v) =>
              v.id === video.id
                ? { ...v, uploading: false, uploaded: true, assetId, progress: 100 }
                : v
            )
          );
        } else {
          toast.error(`Failed to upload ${video.file.name}`);
          setVideos((prev) =>
            prev.map((v) =>
              v.id === video.id ? { ...v, uploading: false, progress: 0 } : v
            )
          );
        }
      }

      if (assetIds.length === 0) {
        toast.error("No videos were uploaded successfully");
        setCreating(false);
        return;
      }

      toast.info("Creating project...");

      // Create project
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type: "product_promo",
          aspectRatio: "landscape",
        }),
      });

      if (!createRes.ok) throw new Error("Failed to create project");
      const { project } = await createRes.json();

      // Generate plan with the uploaded assets
      toast.info("Generating timeline...");
      const planRes = await fetch(`/api/projects/${project.id}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "",
          assetIds,
        }),
      });

      if (!planRes.ok) throw new Error("Failed to generate plan");

      // Start render
      toast.info("Starting render...");
      const renderRes = await fetch(`/api/projects/${project.id}/render`, {
        method: "POST",
      });

      if (!renderRes.ok) {
        // If render fails, still go to the project page
        toast.warning("Render could not start, but project was created");
        router.push(`/app/projects/${project.id}`);
        return;
      }

      toast.success("Render started! Redirecting...");
      router.push(`/app/projects/${project.id}`);
    } catch (error) {
      console.error("Failed to create:", error);
      toast.error("Failed to create video");
    } finally {
      setCreating(false);
    }
  };

  const allUploaded = videos.length > 0 && videos.every((v) => v.uploaded);
  const anyUploading = videos.some((v) => v.uploading);

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Create New Video</h1>
            <p className="text-sm text-muted-foreground">
              Upload videos and render them together
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Video Title</Label>
          <Input
            id="title"
            placeholder="My Awesome Video"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={creating}
          />
        </div>

        {/* Upload Area */}
        <div className="space-y-4">
          <Label>Videos</Label>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={creating}
          />

          {/* Upload Button / Drop Zone */}
          <Card
            className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => !creating && fileInputRef.current?.click()}
          >
            <CardContent className="py-8 text-center">
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload videos</p>
              <p className="text-xs text-muted-foreground mt-1">
                MP4, MOV, WebM supported
              </p>
            </CardContent>
          </Card>

          {/* Video List */}
          {videos.length > 0 && (
            <div className="space-y-2">
              {videos.map((video, index) => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  
                  {/* Thumbnail */}
                  <div className="w-20 h-12 bg-muted rounded overflow-hidden shrink-0">
                    <video
                      src={video.preview}
                      className="w-full h-full object-cover"
                      muted
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {index + 1}. {video.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(video.file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    {video.uploading && (
                      <Progress value={50} className="h-1 mt-1" />
                    )}
                  </div>

                  {/* Status */}
                  {video.uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : video.uploaded ? (
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeVideo(video.id)}
                      disabled={creating}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Button */}
        <Button
          className="w-full h-12 text-base"
          onClick={handleCreate}
          disabled={creating || videos.length === 0 || !title.trim()}
        >
          {creating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {anyUploading ? "Uploading..." : "Creating..."}
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Upload & Render ({videos.length} video{videos.length !== 1 ? "s" : ""})
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Videos will be concatenated in order and rendered on the server
        </p>
      </div>
    </div>
  );
}
