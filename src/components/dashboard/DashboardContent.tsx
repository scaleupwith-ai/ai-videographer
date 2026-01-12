"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Film,
  Plus,
  MoreVertical,
  Play,
  Pencil,
  Trash2,
  Copy,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/date";
import { toast } from "sonner";

interface Project {
  id: string;
  title: string;
  type: string;
  status: "draft" | "rendering" | "finished" | "failed";
  aspect_ratio: string;
  resolution_w: number;
  resolution_h: number;
  created_at: string;
  updated_at: string;
  timeline_json: Record<string, unknown> | null;
}

interface DashboardContentProps {
  initialProjects: Project[];
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

const typeLabels: Record<string, string> = {
  product_promo: "Product Promo",
  real_estate: "Real Estate",
  construction: "Construction",
  testimonial: "Testimonial",
  announcement: "Announcement",
};

export function DashboardContent({ initialProjects }: DashboardContentProps) {
  const router = useRouter();
  const [projects] = useState(initialProjects);

  const handleDelete = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) throw new Error("Failed to delete");
      
      toast.success("Project deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const handleDuplicate = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: "POST",
      });
      
      if (!res.ok) throw new Error("Failed to duplicate");
      
      toast.success("Project duplicated");
      router.refresh();
    } catch {
      toast.error("Failed to duplicate project");
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
            <Film className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Create your first video</h2>
          <p className="text-muted-foreground mb-6">
            Get started by creating a new video project. Choose from our templates and let AI help you craft the perfect video.
          </p>
          <Button
            onClick={() => router.push("/app/new")}
            size="lg"
            className="gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New Video
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => router.push("/app/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            New Video
          </Button>
        </div>
      </header>

      {/* Projects Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => {
            const statusInfo = statusConfig[project.status];
            const StatusIcon = statusInfo.icon;
            
            return (
              <Card
                key={project.id}
                className="group hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/app/projects/${project.id}`)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                    <Film className="w-12 h-12 text-muted-foreground/50" />
                  </div>
                  {project.status === "finished" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "absolute top-2 right-2",
                      statusInfo.className
                    )}
                  >
                    <StatusIcon className={cn(
                      "w-3 h-3 mr-1",
                      project.status === "rendering" && "animate-spin"
                    )} />
                    {statusInfo.label}
                  </Badge>
                </div>

                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-1">
                      {project.title}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem asChild>
                          <Link href={`/app/projects/${project.id}/edit`}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(project.id)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {project.status === "finished" && (
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(project.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="text-xs">
                    {typeLabels[project.type] || project.type} • {project.aspect_ratio}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(project.updated_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

