import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmptyTimeline, createScene } from "@/lib/timeline/v1";
import type { TimelineV1, Scene } from "@/lib/timeline/v1";
import { v4 as uuid } from "uuid";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface AssetRow {
  id: string;
  kind: string;
  duration_sec: number | null;
  filename: string;
}

/**
 * Generate timeline from assets
 * 
 * If assetIds are provided, creates a simple concatenation timeline.
 * Otherwise, uses video type templates.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get project
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { script, assetIds } = body;

    // Create base timeline
    const timeline = createEmptyTimeline({
      id: project.id,
      title: project.title,
      type: project.type,
      aspectRatio: project.aspect_ratio as "landscape" | "vertical" | "square",
    });

    const scenes: Scene[] = [];

    // If specific asset IDs provided, create simple concatenation
    if (assetIds && assetIds.length > 0) {
      // Fetch assets in the order provided
      const { data: assets } = await supabase
        .from("media_assets")
        .select("id, kind, duration_sec, filename")
        .in("id", assetIds)
        .eq("owner_id", user.id);

      // Sort assets to match the order of assetIds
      const assetMap = new Map((assets || []).map((a: AssetRow) => [a.id, a]));
      const orderedAssets = assetIds
        .map((id: string) => assetMap.get(id))
        .filter(Boolean) as AssetRow[];

      // Create a scene for each asset
      for (const asset of orderedAssets) {
        const duration = asset.duration_sec || 5; // Default 5 seconds for images or if unknown
        
        scenes.push(createScene({
          id: uuid(),
          assetId: asset.id,
          kind: asset.kind === "image" ? "image" : "video",
          durationSec: duration,
        }));

        // No overlays for simple concatenation - just the raw videos
        const lastScene = scenes[scenes.length - 1];
        lastScene.overlays = undefined;
        lastScene.transitionOut = null;
      }
    } else {
      // No assets provided - create placeholder scene
      scenes.push(createScene({
        id: uuid(),
        assetId: null,
        kind: "video",
        durationSec: 5,
      }));
      scenes[0].overlays = {
        title: project.title,
        subtitle: "Add media to get started",
        position: "center",
        stylePreset: "boxed",
      };
    }

    // Update timeline with scenes
    const finalTimeline: TimelineV1 = {
      ...timeline,
      scenes,
    };

    // Save timeline to project
    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update({ timeline_json: finalTimeline })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating project:", updateError);
      return NextResponse.json(
        { error: "Failed to save timeline" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      project: updatedProject,
      timeline: finalTimeline,
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }
}
