import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectViewer } from "@/components/project/ProjectViewer";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProject(id: string) {
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    return null;
  }

  return project;
}

async function getLatestRenderJob(projectId: string) {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("render_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return job;
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const renderJob = await getLatestRenderJob(id);

  return <ProjectViewer project={project} renderJob={renderJob} />;
}

