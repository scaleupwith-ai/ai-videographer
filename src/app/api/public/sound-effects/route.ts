import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all public sound effects
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: effects, error } = await supabase
      .from("sound_effects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ effects: effects || [] });
  } catch (error) {
    console.error("Error fetching sound effects:", error);
    return NextResponse.json({ error: "Failed to fetch sound effects" }, { status: 500 });
  }
}







