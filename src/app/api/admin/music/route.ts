import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all music tracks
export async function GET() {
  try {
    const supabase = getAdminSupabase();
    
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

// POST - Create a new music track
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const { title, artist, duration_seconds, audio_url, thumbnail_url, mood, tags } = body;

    if (!title || duration_seconds === undefined || duration_seconds === null || !audio_url) {
      return NextResponse.json(
        { error: "title, duration_seconds, and audio_url are required" },
        { status: 400 }
      );
    }

    const { data: track, error } = await supabase
      .from("music")
      .insert({
        title,
        artist,
        duration_seconds,
        audio_url,
        thumbnail_url,
        mood: mood || [],
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ track });
  } catch (error) {
    console.error("Error creating music:", error);
    return NextResponse.json({ error: "Failed to create music" }, { status: 500 });
  }
}

// DELETE - Delete a music track
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("music")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting music:", error);
    return NextResponse.json({ error: "Failed to delete music" }, { status: 500 });
  }
}

