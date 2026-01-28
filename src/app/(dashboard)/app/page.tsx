import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

async function getProjects() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  
  return projects || [];
}

export default async function DashboardPage() {
  const projects = await getProjects();

  return <DashboardContent initialProjects={projects} />;
}







