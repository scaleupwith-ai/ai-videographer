import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get a specific clip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getAdminSupabase();
    const { id } = await params;

    const { data: clip, error } = await supabase
      .from("clips")
      .select(`
        *,
        renditions:clip_renditions(*),
        clip_tags(tag:tags(*))
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ clip });
  } catch (error) {
    console.error("GET clip error:", error);
    return NextResponse.json({ error: "Failed to fetch clip" }, { status: 500 });
  }
}

// PATCH - Update a clip
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getAdminSupabase();
    const { id } = await params;
    const body = await request.json();

    console.log(`PATCH clip ${id}:`, body);

    const allowedFields = [
      "duration_seconds",
      "description",
      "thumbnail_url",
      "source_resolution",
      "clip_link",
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    console.log(`Updating clip ${id} with:`, updates);

    const { data: clip, error } = await supabase
      .from("clips")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Update clip ${id} error:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update renditions if duration changed
    if (updates.duration_seconds) {
      const { error: renditionError } = await supabase
        .from("clip_renditions")
        .update({ duration_seconds: updates.duration_seconds })
        .eq("clip_id", id);
      
      if (renditionError) {
        console.error(`Update renditions for ${id} error:`, renditionError);
      }
    }

    if (updates.thumbnail_url) {
      await supabase
        .from("clip_renditions")
        .update({ thumbnail_url: updates.thumbnail_url })
        .eq("clip_id", id);
    }

    console.log(`Successfully updated clip ${id}`);
    return NextResponse.json({ clip });
  } catch (error) {
    console.error("PATCH clip error:", error);
    return NextResponse.json({ error: "Failed to update clip" }, { status: 500 });
  }
}

// DELETE - Delete a clip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getAdminSupabase();
    const { id } = await params;

    // Delete clip (cascade will handle clip_tags, clip_keywords, clip_renditions)
    const { error } = await supabase
      .from("clips")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE clip error:", error);
    return NextResponse.json({ error: "Failed to delete clip" }, { status: 500 });
  }
}
