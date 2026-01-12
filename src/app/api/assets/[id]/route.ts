import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the asset first
    const { data: asset, error: fetchError } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete from R2
    try {
      await deleteObject(asset.object_key);
    } catch (r2Error) {
      console.error("Error deleting from R2:", r2Error);
      // Continue with DB deletion even if R2 fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting asset:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete asset" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}

