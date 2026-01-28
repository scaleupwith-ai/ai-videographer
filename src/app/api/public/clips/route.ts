import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all public clips
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: clips, error } = await supabase
      .from("clips")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clips: clips || [] });
  } catch (error) {
    console.error("Error fetching clips:", error);
    return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
  }
}







