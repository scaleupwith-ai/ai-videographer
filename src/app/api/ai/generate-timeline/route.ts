import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseGDriveLink, getDownloadUrl } from "@/lib/gdrive";
import { TimelineV1Schema } from "@/lib/timeline/v1";

interface TimelineScene {
  clipId: string;
  description: string;
  inSec: number;
  outSec: number;
}

interface AITimeline {
  title: string;
  scenes: TimelineScene[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { timeline, projectTitle } = await request.json() as { 
      timeline: AITimeline;
      projectTitle?: string;
    };

    if (!timeline || !timeline.scenes || timeline.scenes.length === 0) {
      return NextResponse.json({ error: "Invalid timeline" }, { status: 400 });
    }

    // Fetch all the clips used in the timeline
    const clipIds = timeline.scenes.map(s => s.clipId);
    const { data: clips, error: clipsError } = await supabase
      .from("clips")
      .select("*")
      .in("id", clipIds);

    if (clipsError || !clips) {
      return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
    }

    // Create a map of clip ID to clip data
    const clipMap = new Map(clips.map(c => [c.id, c]));

    // First, create media_assets entries for each clip (so FFmpeg worker can download them)
    const assetPromises = clips.map(async (clip) => {
      const { fileId, directUrl } = parseGDriveLink(clip.clip_link);
      if (!fileId || !directUrl) {
        throw new Error(`Invalid clip link for clip ${clip.id}`);
      }

      // Check if asset already exists for this clip
      const { data: existingAsset } = await supabase
        .from("media_assets")
        .select("id")
        .eq("storage_key", `gdrive:${fileId}`)
        .eq("owner_id", user.id)
        .single();

      if (existingAsset) {
        return { clipId: clip.id, assetId: existingAsset.id };
      }

      // Create new media asset entry
      const { data: newAsset, error: assetError } = await supabase
        .from("media_assets")
        .insert({
          owner_id: user.id,
          filename: `clip-${clip.id}.mp4`,
          mime_type: "video/mp4",
          size_bytes: 0, // Unknown for GDrive
          storage_key: `gdrive:${fileId}`,
          url: getDownloadUrl(fileId),
          asset_type: "video",
          duration_sec: clip.duration_seconds,
        })
        .select()
        .single();

      if (assetError || !newAsset) {
        throw new Error(`Failed to create asset for clip ${clip.id}`);
      }

      return { clipId: clip.id, assetId: newAsset.id };
    });

    const assetMappings = await Promise.all(assetPromises);
    const clipToAsset = new Map(assetMappings.map(m => [m.clipId, m.assetId]));

    // Build the timeline JSON
    const scenes = timeline.scenes.map((scene, index) => {
      const clip = clipMap.get(scene.clipId);
      const assetId = clipToAsset.get(scene.clipId);
      
      return {
        id: `scene-${index + 1}`,
        order: index,
        assetId: assetId || null,
        kind: "video" as const,
        inSec: scene.inSec,
        outSec: scene.outSec,
        durationSec: scene.outSec - scene.inSec,
        overlays: {
          title: null,
          subtitle: null,
          position: "lower_third",
          stylePreset: "minimal",
        },
      };
    });

    const totalDuration = scenes.reduce((sum, s) => sum + s.durationSec, 0);

    const timelineJson = {
      version: 1,
      project: {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        durationSec: totalDuration,
      },
      scenes,
      global: {
        music: { assetId: null, volume: 0.3 },
        voiceover: { assetId: null, volume: 1.0 },
        brand: {
          logoAssetId: null,
          logoPosition: "top-right",
          logoSize: 80,
        },
        export: {
          codec: "h264",
          crf: 23,
          bitrateMbps: 8,
          audioKbps: 192,
        },
      },
    };

    // Validate the timeline
    const parseResult = TimelineV1Schema.safeParse(timelineJson);
    if (!parseResult.success) {
      console.error("Timeline validation error:", parseResult.error);
      return NextResponse.json({ error: "Failed to generate valid timeline" }, { status: 500 });
    }

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: projectTitle || timeline.title || "AI Generated Video",
        description: `AI-curated video with ${scenes.length} clips`,
        timeline_json: timelineJson,
        status: "draft",
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error("Project creation error:", projectError);
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json({
      projectId: project.id,
      timeline: timelineJson,
    });
  } catch (error) {
    console.error("Generate timeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate timeline" },
      { status: 500 }
    );
  }
}

