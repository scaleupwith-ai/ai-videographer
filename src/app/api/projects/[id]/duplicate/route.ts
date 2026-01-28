import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the original project
    const { data: original, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create duplicate
    const { data: duplicate, error: insertError } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: `${original.title} (Copy)`,
        type: original.type,
        status: "draft",
        aspect_ratio: original.aspect_ratio,
        fps: original.fps,
        resolution_w: original.resolution_w,
        resolution_h: original.resolution_h,
        timeline_json: original.timeline_json,
        brand_preset_id: original.brand_preset_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error duplicating project:", insertError);
      return NextResponse.json(
        { error: "Failed to duplicate project" },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: duplicate });
  } catch (error) {
    console.error("Error duplicating project:", error);
    return NextResponse.json(
      { error: "Failed to duplicate project" },
      { status: 500 }
    );
  }
}







