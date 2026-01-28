"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileVideo,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type UploadStage = "idle" | "uploading" | "creating-job" | "done" | "error";

interface UploadState {
  stage: UploadStage;
  progress: number;
  error?: string;
  jobId?: string;
}

const ACCEPTED_VIDEO_TYPES = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
  "video/x-msvideo": [".avi"],
  "video/x-matroska": [".mkv"],
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function UploadVideoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    stage: "idle",
    progress: 0,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const videoFile = acceptedFiles[0];
    if (videoFile) {
      if (videoFile.size > MAX_FILE_SIZE) {
        setUploadState({
          stage: "error",
          progress: 0,
          error: `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`,
        });
        return;
      }
      setFile(videoFile);
      setUploadState({ stage: "idle", progress: 0 });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_VIDEO_TYPES,
    maxFiles: 1,
    disabled: uploadState.stage !== "idle" && uploadState.stage !== "error",
  });

  const handleUpload = async () => {
    if (!file) return;

    try {
      // Step 1: Get presigned upload URL
      setUploadState({ stage: "uploading", progress: 5 });

      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime: file.type,
          kind: "video",
        }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json();
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { uploadUrl, objectKey } = await urlRes.json();

      // Step 2: Upload file directly to R2
      setUploadState({ stage: "uploading", progress: 10 });

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage");
      }

      setUploadState({ stage: "uploading", progress: 70 });

      // Step 3: Get the public URL and create the video job
      setUploadState({ stage: "creating-job", progress: 80 });

      // Build the public URL (same pattern as complete endpoint)
      const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || ""}/${objectKey}`;

      const jobRes = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetUrl: publicUrl,
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!jobRes.ok) {
        const err = await jobRes.json();
        throw new Error(err.error || "Failed to create video job");
      }

      const { jobId } = await jobRes.json();

      setUploadState({ stage: "done", progress: 100, jobId });

      // Redirect to job page after a short delay
      setTimeout(() => {
        router.push(`/app/jobs/${jobId}`);
      }, 1500);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadState({
        stage: "error",
        progress: 0,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadState({ stage: "idle", progress: 0 });
  };

  const isUploading =
    uploadState.stage === "uploading" || uploadState.stage === "creating-job";

  return (
    <div className="flex-1 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Upload Video for Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Upload any video to get AI-powered analysis including chapters,
            highlights, and summaries.
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle>Select Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dropzone */}
            {!file ? (
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload
                  className={cn(
                    "w-12 h-12 mx-auto mb-4",
                    isDragActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <p className="text-lg font-medium mb-1">
                  {isDragActive
                    ? "Drop your video here"
                    : "Drag & drop your video here"}
                </p>
                <p className="text-muted-foreground text-sm mb-4">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports MP4, MOV, WebM, AVI, MKV • Max {formatFileSize(MAX_FILE_SIZE)}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Preview */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileVideo className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)} • {file.type}
                    </p>
                  </div>
                  {uploadState.stage === "idle" && (
                    <Button variant="ghost" size="icon" onClick={resetUpload}>
                      <X className="w-5 h-5" />
                    </Button>
                  )}
                </div>

                {/* Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {uploadState.stage === "uploading"
                          ? "Uploading to storage..."
                          : "Creating analysis job..."}
                      </span>
                      <span>{uploadState.progress}%</span>
                    </div>
                    <Progress value={uploadState.progress} className="h-2" />
                  </div>
                )}

                {/* Done */}
                {uploadState.stage === "done" && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Upload complete! Redirecting to job page...</span>
                  </div>
                )}

                {/* Error */}
                {uploadState.stage === "error" && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{uploadState.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/app/jobs")}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading || uploadState.stage === "done"}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : uploadState.stage === "done" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Uploaded
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload & Analyze
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <h3 className="font-medium mb-3">What happens after upload?</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                  1
                </span>
                <span>Your video is uploaded directly to our secure storage (R2)</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                  2
                </span>
                <span>TwelveLabs AI analyzes your video content in the background</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                  3
                </span>
                <span>You can close this page - processing continues server-side</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                  4
                </span>
                <span>
                  View results including summary, chapters, and highlights when done
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

