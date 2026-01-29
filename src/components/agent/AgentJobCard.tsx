"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2, Film, FileText, Mic, Music, Wand2, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentJob {
  id: string;
  type: string;
  status: string;
  progress: number;
  input: {
    title?: string;
    description: string;
  };
  state: {
    projectId?: string;
  };
  output?: {
    projectId: string;
    videoUrl: string;
  };
  error?: {
    message: string;
    step: string;
  };
  created_at: string;
  completed_at?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  queued: { label: "Queued", icon: Clock, color: "text-muted-foreground" },
  analyzing: { label: "Analyzing", icon: Wand2, color: "text-blue-500" },
  scripting: { label: "Writing Script", icon: FileText, color: "text-purple-500" },
  voiceover: { label: "Generating Voice", icon: Mic, color: "text-green-500" },
  selecting_clips: { label: "Selecting Clips", icon: Film, color: "text-orange-500" },
  selecting_audio: { label: "Selecting Audio", icon: Music, color: "text-pink-500" },
  building_timeline: { label: "Building Timeline", icon: Wand2, color: "text-cyan-500" },
  rendering: { label: "Rendering", icon: Video, color: "text-yellow-500" },
  completed: { label: "Complete", icon: CheckCircle2, color: "text-emerald-500" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-500" },
};

interface AgentJobCardProps {
  job: AgentJob;
  onViewProject?: (projectId: string) => void;
}

export function AgentJobCard({ job, onViewProject }: AgentJobCardProps) {
  const [currentJob, setCurrentJob] = useState(job);
  const config = STATUS_CONFIG[currentJob.status] || STATUS_CONFIG.queued;
  const Icon = config.icon;
  
  // Poll for updates if job is in progress
  useEffect(() => {
    if (['completed', 'failed'].includes(currentJob.status)) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent/jobs/${currentJob.id}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentJob(data.job);
        }
      } catch (error) {
        console.error("Failed to fetch job status:", error);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [currentJob.id, currentJob.status]);
  
  const isProcessing = !['queued', 'completed', 'failed'].includes(currentJob.status);
  const title = currentJob.input.title || currentJob.input.description.slice(0, 40) + "...";
  
  return (
    <Card className={cn(
      "transition-all",
      isProcessing && "border-primary/30 shadow-lg shadow-primary/10"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn("w-5 h-5", config.color, isProcessing && "animate-pulse")} />
              <Badge variant="outline" className={cn("text-xs", config.color)}>
                {config.label}
              </Badge>
              <Badge variant="secondary" className="text-xs capitalize">
                {currentJob.type.replace("_", " ")}
              </Badge>
            </div>
            
            <h3 className="font-medium truncate">{title}</h3>
            
            {isProcessing && (
              <div className="mt-3">
                <Progress value={currentJob.progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {currentJob.progress}% complete
                </p>
              </div>
            )}
            
            {currentJob.status === 'failed' && currentJob.error && (
              <p className="text-sm text-red-500 mt-2">
                Error: {currentJob.error.message}
              </p>
            )}
            
            {currentJob.status === 'completed' && currentJob.output && (
              <div className="mt-3">
                <Button 
                  size="sm"
                  onClick={() => onViewProject?.(currentJob.output!.projectId)}
                  className="bg-[#00f0ff] hover:bg-[#00d4e0] text-black"
                >
                  View Video
                </Button>
              </div>
            )}
          </div>
          
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {new Date(currentJob.created_at).toLocaleDateString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(currentJob.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AgentJobsListProps {
  onViewProject?: (projectId: string) => void;
}

export function AgentJobsList({ onViewProject }: AgentJobsListProps) {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchJobs();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/agent/jobs?limit=10");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No AI jobs yet</p>
        <p className="text-sm">Create a video to see it here</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <AgentJobCard key={job.id} job={job} onViewProject={onViewProject} />
      ))}
    </div>
  );
}

