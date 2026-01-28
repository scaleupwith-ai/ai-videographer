import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all sound effects
export async function GET() {
  try {
    const supabase = getAdminSupabase();
    
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

// POST - Create a new sound effect
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const { title, description, duration_seconds, audio_url, thumbnail_url, tags } = body;

    if (!title || duration_seconds === undefined || duration_seconds === null || !audio_url) {
      return NextResponse.json(
        { error: "title, duration_seconds, and audio_url are required" },
        { status: 400 }
      );
    }

    const { data: effect, error } = await supabase
      .from("sound_effects")
      .insert({
        title,
        description,
        duration_seconds,
        audio_url,
        thumbnail_url,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ effect });
  } catch (error) {
    console.error("Error creating sound effect:", error);
    return NextResponse.json({ error: "Failed to create sound effect" }, { status: 500 });
  }
}

// DELETE - Delete a sound effect
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("sound_effects")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sound effect:", error);
    return NextResponse.json({ error: "Failed to delete sound effect" }, { status: 500 });
  }
}

