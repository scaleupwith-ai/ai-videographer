"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileVideo,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VideoJob {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  asset_url: string;
  filename: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
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

export default function VideoJobsPage() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch("/api/video-jobs");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (err) {
        console.error("Error fetching jobs:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchJobs();
  }, []);

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Video Analysis Jobs</h1>
            <p className="text-muted-foreground mt-1">
              Upload videos for AI-powered analysis using TwelveLabs
            </p>
          </div>
          <Link href="/app/jobs/upload">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Upload Video
            </Button>
          </Link>
        </div>

        {/* Jobs List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileVideo className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No video jobs yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Upload a video to get started with AI-powered analysis.
                TwelveLabs will analyze your video content and provide detailed
                insights.
              </p>
              <Link href="/app/jobs/upload">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Upload Your First Video
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const StatusIcon = statusConfig[job.status].icon;
              return (
                <Link key={job.id} href={`/app/jobs/${job.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-4">
                      {/* Video Icon */}
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileVideo className="w-6 h-6 text-muted-foreground" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {job.filename || "Untitled Video"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>

                      {/* Status */}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0",
                          statusConfig[job.status].bgColor,
                          statusConfig[job.status].color
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "w-3 h-3 mr-1.5",
                            job.status === "processing" && "animate-spin"
                          )}
                        />
                        {statusConfig[job.status].label}
                        {job.status === "processing" && ` (${job.progress}%)`}
                      </Badge>

                      {/* Arrow */}
                      <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

