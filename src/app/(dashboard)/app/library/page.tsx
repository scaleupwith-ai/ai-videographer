import { createClient } from "@/lib/supabase/server";
import { LibraryContent } from "@/components/library/LibraryContent";

async function getAssets() {
  const supabase = await createClient();
  const { data: assets } = await supabase
    .from("media_assets")
    .select("*")
    .order("created_at", { ascending: false });
  
  return assets || [];
}

export default async function LibraryPage() {
  const assets = await getAssets();

  return <LibraryContent initialAssets={assets} />;
}

