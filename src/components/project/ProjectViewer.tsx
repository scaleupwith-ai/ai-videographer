"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Pencil,
  Copy,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Film,
  Volume2,
  VolumeX,
  Maximize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, formatDuration } from "@/lib/date";
import { toast } from "sonner";
import type { Project, RenderJob } from "@/lib/database.types";

interface ProjectViewerProps {
  project: Project;
  renderJob: RenderJob | null;
}

const statusConfig = {
  draft: {
    label: "Draft",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  rendering: {
    label: "Rendering",
    icon: Loader2,
    className: "bg-chart-1/20 text-chart-1",
  },
  finished: {
    label: "Finished",
    icon: CheckCircle,
    className: "bg-chart-2/20 text-chart-2",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive",
  },
};

export function ProjectViewer({ project: initialProject, renderJob: initialRenderJob }: ProjectViewerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [project, setProject] = useState(initialProject);
  const [renderJob, setRenderJob] = useState(initialRenderJob);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Poll for render job updates if rendering
  useEffect(() => {
    if (project.status !== "rendering" || !renderJob) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/render-jobs/${renderJob.id}`);
        if (res.ok) {
          const data = await res.json();
          setRenderJob(data.job);
          
          if (data.job.status === "finished" || data.job.status === "failed") {
            // Refresh project data
            const projRes = await fetch(`/api/projects/${project.id}`);
            if (projRes.ok) {
              const projData = await projRes.json();
              setProject(projData.project);
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll render job:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [project.status, project.id, renderJob]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      
      if (!res.ok) throw new Error("Failed to delete");
      
      toast.success("Project deleted");
      router.push("/app");
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
      });
      
      if (!res.ok) throw new Error("Failed to duplicate");
      
      const { project: newProject } = await res.json();
      toast.success("Project duplicated");
      router.push(`/app/projects/${newProject.id}`);
    } catch {
      toast.error("Failed to duplicate project");
    }
  };

  const handleRerender = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/render`, {
        method: "POST",
      });
      
      if (!res.ok) throw new Error("Failed to start render");
      
      const { job } = await res.json();
      setRenderJob(job);
      setProject((p) => ({ ...p, status: "rendering" }));
      toast.success("Render started");
    } catch {
      toast.error("Failed to start render");
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const statusInfo = statusConfig[project.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-background border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/app")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{project.title}</h1>
                <Badge variant="secondary" className={statusInfo.className}>
                  <StatusIcon className={cn(
                    "w-3 h-3 mr-1",
                    project.status === "rendering" && "animate-spin"
                  )} />
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Updated {formatDistanceToNow(project.updated_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/app/projects/${project.id}/edit`)}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={handleDuplicate}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </Button>
            {project.output_url && (
              <Button variant="outline" asChild>
                <a href={project.output_url} download>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Video Player or Status */}
          {project.status === "finished" && project.output_url ? (
            <Card className="overflow-hidden">
              <div className="aspect-video bg-black relative">
                <video
                  ref={videoRef}
                  src={project.output_url}
                  className="w-full h-full"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  muted={isMuted}
                />
                
                {/* Video Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center gap-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={togglePlay}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </Button>

                    <div className="flex-1">
                      <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="cursor-pointer"
                      />
                    </div>

                    <span className="text-white text-sm font-mono min-w-[80px]">
                      {formatDuration(currentTime)} / {formatDuration(duration)}
                    </span>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => videoRef.current?.requestFullscreen()}
                    >
                      <Maximize className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : project.status === "rendering" && renderJob ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  Rendering in progress
                </CardTitle>
                <CardDescription>
                  Your video is being rendered. This may take a few minutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(renderJob.progress || 0)}%</span>
                  </div>
                  <Progress value={renderJob.progress || 0} />
                </div>

                {renderJob.logs && renderJob.logs.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Logs</span>
                    <ScrollArea className="h-32 rounded border border-border bg-muted/50 p-2">
                      <pre className="text-xs font-mono text-muted-foreground">
                        {renderJob.logs.slice(-20).join("\n")}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : project.status === "failed" ? (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <XCircle className="w-5 h-5" />
                  Render failed
                </CardTitle>
                <CardDescription>
                  {renderJob?.error || "An error occurred during rendering."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleRerender}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Film className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No video yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add assets and edit your timeline to generate a video.
                </p>
                <Button onClick={() => router.push(`/app/projects/${project.id}/edit`)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Project
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{project.type.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aspect Ratio</span>
                  <span className="font-medium capitalize">{project.aspect_ratio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolution</span>
                  <span className="font-medium">{project.resolution_w}x{project.resolution_h}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FPS</span>
                  <span className="font-medium">{project.fps}</span>
                </div>
                {project.duration_sec && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{formatDuration(project.duration_sec)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {project.timeline_json ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Scenes</span>
                      <span className="font-medium">
                        {(project.timeline_json as { scenes?: unknown[] }).scenes?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span className="font-medium">
                        {(project.timeline_json as { version?: number }).version || 1}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No timeline configured</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

