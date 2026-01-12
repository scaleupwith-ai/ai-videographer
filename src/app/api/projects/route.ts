import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmptyTimeline } from "@/lib/timeline/v1";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, type, aspectRatio } = body;

    if (!title || !type || !aspectRatio) {
      return NextResponse.json(
        { error: "Missing required fields: title, type, aspectRatio" },
        { status: 400 }
      );
    }

    // Determine resolution based on aspect ratio
    const resolutions = {
      landscape: { w: 1920, h: 1080 },
      vertical: { w: 1080, h: 1920 },
      square: { w: 1080, h: 1080 },
    };

    const resolution = resolutions[aspectRatio as keyof typeof resolutions] || resolutions.landscape;

    // Create project
    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title,
        type,
        status: "draft",
        aspect_ratio: aspectRatio,
        fps: 30,
        resolution_w: resolution.w,
        resolution_h: resolution.h,
        timeline_json: null, // Will be set by generate-plan
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating project:", insertError);
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: projects, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching projects:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

