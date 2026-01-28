import { createClient } from "@/lib/supabase/server";
import { AssetsContent } from "@/components/assets/AssetsContent";

async function getAssets() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return [];
  
  const { data: assets } = await supabase
    .from("media_assets")
    .select("*")
    .eq("owner_id", user.id)
    .in("kind", ["video", "image"]) // Only show videos and images (user's product media)
    .order("created_at", { ascending: false });
  
  return assets || [];
}

export default async function AssetsPage() {
  const assets = await getAssets();

  return <AssetsContent initialAssets={assets} />;
}







