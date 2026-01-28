import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all public music tracks
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: tracks, error } = await supabase
      .from("music")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tracks: tracks || [] });
  } catch (error) {
    console.error("Error fetching music:", error);
    return NextResponse.json({ error: "Failed to fetch music" }, { status: 500 });
  }
}







