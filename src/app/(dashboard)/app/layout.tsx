import { createClient } from "@/lib/supabase/server";
import { AppLayout } from "@/components/layout/AppLayout";

async function getProjects() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  
  return (projects || []).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status as "draft" | "rendering" | "finished" | "failed",
    updatedAt: p.updated_at,
  }));
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const projects = await getProjects();

  return <AppLayout projects={projects}>{children}</AppLayout>;
}







