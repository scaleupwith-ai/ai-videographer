import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all public overlays
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: overlays, error } = await supabase
      .from("overlays")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ overlays: overlays || [] });
  } catch (error) {
    console.error("Error fetching overlays:", error);
    return NextResponse.json({ error: "Failed to fetch overlays" }, { status: 500 });
  }
}







