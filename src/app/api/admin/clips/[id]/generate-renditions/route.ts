import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const RESOLUTION_CONFIG = {
  "4k": { width: 3840, height: 2160, generates: ["1080p", "720p"] },
  "1080p": { width: 1920, height: 1080, generates: ["720p"] },
  "720p": { width: 1280, height: 720, generates: [] },
} as const;

/**
 * POST /api/admin/clips/[id]/generate-renditions
 * Triggers FFmpeg to generate lower resolution versions of a clip
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminSupabase();

    // Get the clip
    const { data: clip, error: clipError } = await supabase
      .from("clips")
      .select("*")
      .eq("id", id)
      .single();

    if (clipError || !clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    const sourceRes = clip.source_resolution || "1080p";
    const config = RESOLUTION_CONFIG[sourceRes as keyof typeof RESOLUTION_CONFIG];
    
    if (!config || config.generates.length === 0) {
      return NextResponse.json({ 
        message: "No renditions to generate for this resolution",
        sourceResolution: sourceRes,
      });
    }

    // Check existing renditions
    const { data: existingRenditions } = await supabase
      .from("clip_renditions")
      .select("resolution")
      .eq("clip_id", id);

    const existingResolutions = new Set(existingRenditions?.map(r => r.resolution) || []);
    const missingRenditions = config.generates.filter(res => !existingResolutions.has(res));

    if (missingRenditions.length === 0) {
      return NextResponse.json({ 
        message: "All renditions already exist",
        renditions: Array.from(existingResolutions),
      });
    }

    // Call the worker to generate renditions
    const workerUrl = process.env.RENDER_WORKER_URL || "http://localhost:3001";
    
    const response = await fetch(`${workerUrl}/generate-renditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clipId: id,
        sourceUrl: clip.clip_link,
        sourceResolution: sourceRes,
        targetResolutions: missingRenditions,
        duration: clip.duration_seconds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Worker error:", errorText);
      return NextResponse.json(
        { error: "Failed to start rendition generation. Worker may be unavailable." },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      message: "Rendition generation started",
      clipId: id,
      targetResolutions: missingRenditions,
      jobId: result.jobId,
    });
  } catch (error) {
    console.error("Generate renditions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate renditions" },
      { status: 500 }
    );
  }
}







