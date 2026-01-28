import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Resolution configurations
const RESOLUTION_CONFIG = {
  "4k": { width: 3840, height: 2160, generates: ["1080p", "720p"] },
  "1080p": { width: 1920, height: 1080, generates: ["720p"] },
  "720p": { width: 1280, height: 720, generates: [] },
} as const;

export async function POST(request: NextRequest) {
  const supabase = getAdminSupabase();
  
  const results: Array<{
    clipId: string;
    status: "success" | "error" | "skipped";
    message: string;
    duration?: number;
    thumbnail?: boolean;
    renditions?: string[];
  }> = [];

  try {
    // Fetch all clips with their renditions
    const { data: clips, error: clipsError } = await supabase
      .from("clips")
      .select(`
        id,
        clip_link,
        duration_seconds,
        source_resolution,
        thumbnail_url,
        renditions:clip_renditions(resolution, clip_url)
      `)
      .order("created_at", { ascending: false });

    if (clipsError) {
      return NextResponse.json({ error: clipsError.message }, { status: 500 });
    }

    if (!clips || clips.length === 0) {
      return NextResponse.json({ message: "No clips to process" });
    }

    // Process each clip
    for (const clip of clips) {
      const clipResult: typeof results[0] = {
        clipId: clip.id,
        status: "success",
        message: "",
      };

      try {
        const updates: any = {};
        const messages: string[] = [];

        // 1. Fix duration if it's 0 or null
        if (!clip.duration_seconds || clip.duration_seconds === 0) {
          // We need to get duration from the video
          // For now, set a placeholder - the worker will detect actual duration
          // Or we can use a client-side approach
          const estimatedDuration = await estimateDuration(clip.clip_link);
          if (estimatedDuration) {
            updates.duration_seconds = estimatedDuration;
            clipResult.duration = estimatedDuration;
            messages.push(`Duration set to ${estimatedDuration}s`);
            
            // Also update the rendition duration
            await supabase
              .from("clip_renditions")
              .update({ duration_seconds: estimatedDuration })
              .eq("clip_id", clip.id);
          }
        }

        // 2. Generate thumbnail if missing
        if (!clip.thumbnail_url) {
          // Generate thumbnail URL from first frame
          // For R2-hosted videos, we can create a thumbnail by requesting a frame
          const thumbnailUrl = await generateThumbnail(clip.clip_link, clip.id, supabase);
          if (thumbnailUrl) {
            updates.thumbnail_url = thumbnailUrl;
            clipResult.thumbnail = true;
            messages.push("Thumbnail generated");
            
            // Also update rendition thumbnail
            await supabase
              .from("clip_renditions")
              .update({ thumbnail_url: thumbnailUrl })
              .eq("clip_id", clip.id);
          }
        }

        // 3. Check which renditions are missing
        const sourceRes = clip.source_resolution || "1080p";
        const config = RESOLUTION_CONFIG[sourceRes as keyof typeof RESOLUTION_CONFIG];
        const existingRenditions = clip.renditions?.map((r: any) => r.resolution) || [];
        const missingRenditions = config?.generates.filter(
          res => !existingRenditions.includes(res)
        ) || [];

        if (missingRenditions.length > 0) {
          // Queue rendition generation (this would normally go to a worker)
          // For now, just note which are missing
          clipResult.renditions = missingRenditions;
          messages.push(`Needs renditions: ${missingRenditions.join(", ")}`);
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("clips")
            .update(updates)
            .eq("id", clip.id);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }
        }

        clipResult.message = messages.length > 0 ? messages.join("; ") : "No changes needed";
        if (messages.length === 0) {
          clipResult.status = "skipped";
        }

      } catch (error) {
        clipResult.status = "error";
        clipResult.message = error instanceof Error ? error.message : "Unknown error";
      }

      results.push(clipResult);
    }

    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;
    const skippedCount = results.filter(r => r.status === "skipped").length;

    return NextResponse.json({
      summary: {
        total: clips.length,
        success: successCount,
        errors: errorCount,
        skipped: skippedCount,
      },
      results,
    });

  } catch (error) {
    console.error("Process all clips error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

// Estimate duration by fetching video metadata
// This is a simple approach - for accurate duration, use ffprobe on worker
async function estimateDuration(clipUrl: string): Promise<number | null> {
  try {
    // For videos with known patterns, estimate based on file size
    // Or return a default duration to be fixed later
    // A better approach would be to call a worker endpoint
    
    // For now, return null - duration will need to be set manually or via worker
    return null;
  } catch {
    return null;
  }
}

// Generate thumbnail from video
async function generateThumbnail(
  clipUrl: string, 
  clipId: string,
  supabase: any
): Promise<string | null> {
  try {
    // For R2 videos, we can't generate thumbnails server-side without ffmpeg
    // The thumbnail will need to be generated by the worker or uploaded manually
    // For now, return null
    return null;
  } catch {
    return null;
  }
}







