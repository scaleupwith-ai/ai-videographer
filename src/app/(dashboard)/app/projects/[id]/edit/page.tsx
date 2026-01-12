import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SceneEditor } from "@/components/editor/SceneEditor";

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

async function getAssets(ownerId: string) {
  const supabase = await createClient();
  const { data: assets } = await supabase
    .from("media_assets")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  return assets || [];
}

async function getBrandPresets(ownerId: string) {
  const supabase = await createClient();
  const { data: presets } = await supabase
    .from("brand_presets")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  return presets || [];
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const assets = await getAssets(project.owner_id);
  const brandPresets = await getBrandPresets(project.owner_id);

  return (
    <SceneEditor
      project={project}
      assets={assets}
      brandPresets={brandPresets}
    />
  );
}

