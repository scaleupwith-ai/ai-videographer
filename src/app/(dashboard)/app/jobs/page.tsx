"use client";

import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { AgentJobsList } from "@/components/agent/AgentJobCard";

export default function AgentJobsPage() {
  const router = useRouter();
  
  const handleViewProject = (projectId: string) => {
    router.push(`/app/projects/${projectId}`);
  };
  
  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">AI Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Track your AI-generated videos
            </p>
          </div>
        </div>
      </header>

      {/* Jobs List */}
      <div className="p-6 max-w-3xl">
        <AgentJobsList onViewProject={handleViewProject} />
      </div>
    </div>
  );
}

