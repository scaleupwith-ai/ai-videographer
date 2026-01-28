"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  FileVideo,
  Sparkles,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface VideoJobStatus {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  resultJson: {
    videoId?: string;
    taskId?: string;
    summary?: string;
    chapters?: Array<{
      chapter_number: number;
      start: number;
      end: number;
      chapter_title: string;
      chapter_summary: string;
    }>;
    highlights?: Array<{
      start: number;
      end: number;
      highlight: string;
      highlight_summary: string;
    }>;
    metadata?: {
      filename?: string;
      duration?: number;
      width?: number;
      height?: number;
    };
    thumbnails?: string[];
  } | null;
  error: string | null;
  assetUrl: string;
  filename: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusConfig = {
  queued: {
    icon: Clock,
    label: "Queued",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  done: {
    icon: CheckCircle2,
    label: "Complete",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function VideoJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<VideoJobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch job status
  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/video-jobs/${jobId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError("Job not found");
          return;
        }
        throw new Error("Failed to fetch job");
      }

      const data = await res.json();
      setJob(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching job:", err);
      setError("Failed to load job status");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  // Polling effect - polls every 5s while page is mounted and job isn't done/failed
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      await fetchJob();
    }

    // Initial fetch
    poll();

    // Set up polling interval
    const timer = setInterval(() => {
      // Check if we should continue polling
      if (cancelled) return;
      if (job?.status === "done" || job?.status === "failed") {
        clearInterval(timer);
        return;
      }
      poll();
    }, 5000);

    // Cleanup on unmount
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fetchJob, job?.status]);

  // Handle retry
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/video-jobs/${jobId}/retry`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to retry job");
      }

      // Refresh job status
      await fetchJob();
    } catch (err) {
      console.error("Error retrying job:", err);
      setError(err instanceof Error ? err.message : "Failed to retry job");
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <XCircle className="w-12 h-12 text-destructive" />
        <p className="text-lg text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => router.push("/app/jobs")}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  if (!job) return null;

  const StatusIcon = statusConfig[job.status].icon;
  const result = job.resultJson;

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">
              {job.filename || "Video Analysis"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Created {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "text-sm px-3 py-1",
              statusConfig[job.status].bgColor,
              statusConfig[job.status].color
            )}
          >
            <StatusIcon
              className={cn(
                "w-4 h-4 mr-2",
                job.status === "processing" && "animate-spin"
              )}
            />
            {statusConfig[job.status].label}
          </Badge>
        </div>

        {/* Progress Section - Show for queued/processing */}
        {(job.status === "queued" || job.status === "processing") && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Processing Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {job.progress}%
                  </span>
                </div>
                <Progress value={job.progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  {job.status === "queued"
                    ? "Waiting to start processing..."
                    : job.progress < 20
                    ? "Uploading video to TwelveLabs..."
                    : job.progress < 70
                    ? "Indexing video content..."
                    : "Generating analysis..."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Section - Show for failed */}
        {job.status === "failed" && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <XCircle className="w-12 h-12 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Processing Failed
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {job.error || "An unknown error occurred"}
                  </p>
                </div>
                <Button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="gap-2"
                >
                  {isRetrying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Retry Processing
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section - Show for done */}
        {job.status === "done" && result && (
          <div className="space-y-6">
            {/* Video Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileVideo className="w-5 h-5" />
                  Video Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <video
                    src={job.assetUrl}
                    controls
                    className="w-full h-full object-contain"
                    poster={result.thumbnails?.[0]}
                  />
                </div>
                {result.metadata && (
                  <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                    {result.metadata.duration && (
                      <span>
                        Duration: {formatDuration(result.metadata.duration)}
                      </span>
                    )}
                    {result.metadata.width && result.metadata.height && (
                      <span>
                        Resolution: {result.metadata.width}×
                        {result.metadata.height}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            {result.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {result.summary}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Chapters */}
            {result.chapters && result.chapters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Chapters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {result.chapters.map((chapter, idx) => (
                        <div
                          key={idx}
                          className="flex gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="shrink-0 w-20 text-sm font-mono text-muted-foreground">
                            {formatTimestamp(chapter.start)} -{" "}
                            {formatTimestamp(chapter.end)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {chapter.chapter_title}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {chapter.chapter_summary}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Highlights */}
            {result.highlights && result.highlights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Highlights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.highlights.map((highlight, idx) => (
                      <div
                        key={idx}
                        className="flex gap-4 p-3 rounded-lg border"
                      >
                        <Badge variant="outline" className="shrink-0">
                          {formatTimestamp(highlight.start)} -{" "}
                          {formatTimestamp(highlight.end)}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{highlight.highlight}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {highlight.highlight_summary}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Link href="/app/jobs">
            <Button variant="outline">View All Jobs</Button>
          </Link>
          <Link href="/app/jobs/upload">
            <Button>Upload Another Video</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

