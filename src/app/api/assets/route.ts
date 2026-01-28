import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Fetch user's assets
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's media assets (video and image only)
    const { data: assets, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("owner_id", user.id)
      .in("kind", ["video", "image"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching assets:", error);
      return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
    }

    return NextResponse.json({ assets: assets || [] });
  } catch (error) {
    console.error("Error in assets API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}







