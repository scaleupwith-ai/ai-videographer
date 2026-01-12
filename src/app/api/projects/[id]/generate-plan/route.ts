import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmptyTimeline, createScene } from "@/lib/timeline/v1";
import type { TimelineV1, Scene } from "@/lib/timeline/v1";
import { v4 as uuid } from "uuid";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * AI Director Stub
 * 
 * This is a simplified version that creates a timeline structure based on:
 * - Video type
 * - Script/bullets provided
 * - Available assets
 * 
 * In a production version, this would call an LLM API to intelligently
 * select scenes, write overlay text, and structure the video.
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

    // Get user's assets if specific IDs provided, otherwise get all
    let assets = [];
    if (assetIds && assetIds.length > 0) {
      const { data } = await supabase
        .from("media_assets")
        .select("*")
        .in("id", assetIds)
        .eq("owner_id", user.id);
      assets = data || [];
    } else {
      const { data } = await supabase
        .from("media_assets")
        .select("*")
        .eq("owner_id", user.id)
        .in("kind", ["video", "image"])
        .order("created_at", { ascending: false })
        .limit(10);
      assets = data || [];
    }

    // Create base timeline
    const timeline = createEmptyTimeline({
      id: project.id,
      title: project.title,
      type: project.type,
      aspectRatio: project.aspect_ratio as "landscape" | "vertical" | "square",
    });

    // Generate scenes based on video type and script
    const scenes: Scene[] = [];
    
    // Parse script into bullet points (simple split)
    const bullets = script
      ? script.split(/[\n\r]+/).filter((line: string) => line.trim().length > 0)
      : [];

    // Video type specific scene generation
    const videoTypeScenes = getVideoTypeTemplate(project.type, bullets);

    // Create scenes, assigning assets if available
    for (let i = 0; i < videoTypeScenes.length; i++) {
      const template = videoTypeScenes[i];
      const asset = assets[i % (assets.length || 1)] || null;
      
      scenes.push(createScene({
        id: uuid(),
        assetId: asset?.id || null,
        kind: asset?.kind === "image" ? "image" : "video",
        durationSec: template.duration,
      }));

      // Update overlay text
      if (scenes[i]) {
        scenes[i].overlays = {
          title: template.title,
          subtitle: template.subtitle,
          position: template.position as "center" | "top" | "bottom" | "lower_third" | "upper_third",
          stylePreset: template.style as "boxed" | "lower_third" | "minimal",
        };
        scenes[i].transitionOut = i < videoTypeScenes.length - 1 ? "crossfade" : null;
      }
    }

    // If no scenes generated, create a default opening scene
    if (scenes.length === 0) {
      scenes.push(createScene({
        id: uuid(),
        assetId: null,
        kind: "video",
        durationSec: 5,
      }));
      scenes[0].overlays = {
        title: project.title,
        subtitle: "Add your media to get started",
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

/**
 * Get scene templates based on video type
 */
function getVideoTypeTemplate(videoType: string, bullets: string[]) {
  const templates: Record<string, Array<{
    title: string;
    subtitle: string | null;
    duration: number;
    position: string;
    style: string;
  }>> = {
    product_promo: [
      { title: "Introducing", subtitle: bullets[0] || "Your Product", duration: 4, position: "center", style: "boxed" },
      { title: "Key Features", subtitle: bullets[1] || null, duration: 5, position: "lower_third", style: "lower_third" },
      { title: "Benefits", subtitle: bullets[2] || null, duration: 5, position: "lower_third", style: "lower_third" },
      { title: "Get Started Today", subtitle: bullets[3] || "Visit our website", duration: 4, position: "center", style: "boxed" },
    ],
    real_estate: [
      { title: "Property Tour", subtitle: bullets[0] || "Welcome", duration: 4, position: "center", style: "boxed" },
      { title: "Living Space", subtitle: bullets[1] || null, duration: 5, position: "lower_third", style: "minimal" },
      { title: "Kitchen", subtitle: bullets[2] || null, duration: 4, position: "lower_third", style: "minimal" },
      { title: "Bedrooms", subtitle: bullets[3] || null, duration: 4, position: "lower_third", style: "minimal" },
      { title: "Contact Us", subtitle: bullets[4] || "Schedule a viewing", duration: 4, position: "center", style: "boxed" },
    ],
    construction: [
      { title: "Project Update", subtitle: bullets[0] || null, duration: 4, position: "center", style: "boxed" },
      { title: "Progress", subtitle: bullets[1] || "Week overview", duration: 5, position: "lower_third", style: "lower_third" },
      { title: "Milestones", subtitle: bullets[2] || null, duration: 5, position: "lower_third", style: "lower_third" },
      { title: "Next Steps", subtitle: bullets[3] || null, duration: 4, position: "center", style: "boxed" },
    ],
    testimonial: [
      { title: bullets[0] || "Customer Story", subtitle: null, duration: 5, position: "center", style: "boxed" },
      { title: bullets[1] || "", subtitle: null, duration: 8, position: "lower_third", style: "minimal" },
      { title: bullets[2] || "Thank You", subtitle: null, duration: 4, position: "center", style: "boxed" },
    ],
    announcement: [
      { title: "Announcement", subtitle: bullets[0] || null, duration: 4, position: "center", style: "boxed" },
      { title: bullets[1] || "Big News", subtitle: bullets[2] || null, duration: 5, position: "center", style: "boxed" },
      { title: "Learn More", subtitle: bullets[3] || null, duration: 4, position: "center", style: "boxed" },
    ],
  };

  return templates[videoType] || templates.product_promo;
}

