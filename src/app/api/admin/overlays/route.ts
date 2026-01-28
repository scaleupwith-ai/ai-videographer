import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all overlays
export async function GET() {
  try {
    const supabase = getAdminSupabase();
    
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

// POST - Create a new overlay
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const { title, description, image_url, thumbnail_url, width, height, tags } = body;

    if (!title || !image_url) {
      return NextResponse.json(
        { error: "title and image_url are required" },
        { status: 400 }
      );
    }

    const { data: overlay, error } = await supabase
      .from("overlays")
      .insert({
        title,
        description,
        image_url,
        thumbnail_url,
        width,
        height,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ overlay });
  } catch (error) {
    console.error("Error creating overlay:", error);
    return NextResponse.json({ error: "Failed to create overlay" }, { status: 500 });
  }
}

// DELETE - Delete an overlay
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("overlays")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting overlay:", error);
    return NextResponse.json({ error: "Failed to delete overlay" }, { status: 500 });
  }
}

