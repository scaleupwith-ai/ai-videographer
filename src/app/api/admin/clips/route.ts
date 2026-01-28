import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Resolution configurations
const RESOLUTION_CONFIG = {
  "4k": { width: 3840, height: 2160, generates: ["1080p", "720p"] },
  "1080p": { width: 1920, height: 1080, generates: ["720p"] },
  "720p": { width: 1280, height: 720, generates: [] },
} as const;

// GET - List all clips with their renditions and tags
export async function GET() {
  try {
    const supabase = getAdminSupabase();
    
    // Fetch clips with renditions
    const { data: clips, error } = await supabase
      .from("clips")
      .select(`
        *,
        renditions:clip_renditions(*),
        clip_tags(
          tag:tags(id, name, category, color)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Categorize clips and flatten tags
    const categorized = (clips || []).map(clip => ({
      ...clip,
      // Flatten tags from junction table
      clipTags: clip.clip_tags?.map((ct: any) => ct.tag).filter(Boolean) || [],
      linkType: clip.clip_link?.includes("drive.google.com") ? "gdrive" :
                clip.clip_link?.includes("r2.") || clip.clip_link?.includes("cloudflare") ? "r2" :
                "other",
      needsMigration: clip.clip_link?.includes("drive.google.com"),
      hasAllRenditions: checkRenditions(clip.source_resolution, clip.renditions),
    }));

    return NextResponse.json({ clips: categorized });
  } catch (error) {
    console.error("Error fetching clips:", error);
    return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
  }
}

// Helper to check if all expected renditions exist
function checkRenditions(sourceRes: string, renditions: any[]): boolean {
  if (!sourceRes || !renditions) return false;
  
  const config = RESOLUTION_CONFIG[sourceRes as keyof typeof RESOLUTION_CONFIG];
  if (!config) return false;
  
  // Check if source resolution rendition exists
  const hasSource = renditions.some(r => r.resolution === sourceRes);
  
  // Check if all generated renditions exist
  const hasAllGenerated = config.generates.every(
    res => renditions.some(r => r.resolution === res)
  );
  
  return hasSource && hasAllGenerated;
}

// POST - Create a new clip with tags (junction table) and keywords
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const { 
      clip_link, 
      duration_seconds, 
      description, 
      tagIds, // Array of tag UUIDs
      keywords, // Array of long-tail keywords
      thumbnail_url, 
      source_resolution 
    } = body;

    if (!clip_link || !duration_seconds) {
      return NextResponse.json(
        { error: "clip_link and duration_seconds are required" },
        { status: 400 }
      );
    }

    // Validate tag count (8-20 recommended)
    if (tagIds && tagIds.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 tags allowed per clip" },
        { status: 400 }
      );
    }

    // Validate resolution
    const resolution = source_resolution || "1080p";
    if (!["4k", "1080p", "720p"].includes(resolution)) {
      return NextResponse.json(
        { error: "Invalid resolution. Must be 4k, 1080p, or 720p" },
        { status: 400 }
      );
    }

    const resConfig = RESOLUTION_CONFIG[resolution as keyof typeof RESOLUTION_CONFIG];

    // Create the clip (without tags column - using junction table now)
    const { data: clip, error } = await supabase
      .from("clips")
      .insert({
        clip_link,
        duration_seconds,
        description,
        thumbnail_url,
        source_resolution: resolution,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Insert tags into junction table (clip_tags)
    if (tagIds && tagIds.length > 0) {
      const tagInserts = tagIds.map((tagId: string) => ({
        clip_id: clip.id,
        tag_id: tagId,
      }));
      
      const { error: tagError } = await supabase
        .from("clip_tags")
        .insert(tagInserts);
      
      if (tagError) {
        console.error("Error inserting clip tags:", tagError);
      } else {
        console.log(`Inserted ${tagIds.length} tags for clip ${clip.id}`);
      }
    }

    // Insert keywords into clip_keywords table
    if (keywords && keywords.length > 0) {
      const keywordInserts = keywords.map((kw: string) => ({
        clip_id: clip.id,
        keyword: kw.toLowerCase().trim(),
      }));
      
      const { error: kwError } = await supabase
        .from("clip_keywords")
        .insert(keywordInserts);
      
      if (kwError) {
        console.error("Error inserting clip keywords:", kwError);
      }
    }

    // Create the source resolution rendition
    const { error: renditionError } = await supabase
      .from("clip_renditions")
      .insert({
        clip_id: clip.id,
        resolution: resolution,
        resolution_width: resConfig.width,
        resolution_height: resConfig.height,
        clip_url: clip_link,
        file_size_bytes: null,
        duration_seconds: duration_seconds,
        thumbnail_url: thumbnail_url,
      });

    if (renditionError) {
      console.error("Error creating source rendition:", renditionError);
    }

    // Return clip with info
    return NextResponse.json({ 
      clip,
      tagCount: tagIds?.length || 0,
      keywordCount: keywords?.length || 0,
      pendingRenditions: resConfig.generates,
      message: resConfig.generates.length > 0 
        ? `Clip created with ${tagIds?.length || 0} tags. ${resConfig.generates.join(", ")} renditions pending.`
        : `Clip created with ${tagIds?.length || 0} tags.`,
    });
  } catch (error) {
    console.error("Error creating clip:", error);
    return NextResponse.json({ error: "Failed to create clip" }, { status: 500 });
  }
}
