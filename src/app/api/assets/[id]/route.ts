import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: asset, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching asset:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Error fetching asset:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { metadata, tags } = body;

    // Build update object
    const updates: Record<string, unknown> = {};
    if (metadata !== undefined) updates.metadata = metadata;
    if (tags !== undefined) updates.tags = tags;
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data: asset, error } = await supabase
      .from("media_assets")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", user.id) // Ensure user owns the asset
      .select()
      .single();

    if (error) {
      console.error("Error updating asset:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!asset) {
      return NextResponse.json({ error: "Asset not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the asset (only if owned by user)
    const { error } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Error deleting asset:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
