import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Background video/image analysis endpoint
 * For videos: Creates a TwelveLabs video job for deep analysis
 * For images: Basic metadata extraction (no AI analysis for now)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: assetId } = await params;
  
  console.log(`[Asset Analyze] Starting analysis for asset ${assetId}`);
  
  try {
    // Use admin client to fetch asset since this might be called internally
    // immediately after insert, before the user's session cookie propagates
    const adminClient = createAdminClient();
    
    // Get reference from request body if provided
    let body: { reference?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, that's fine
    }
    const { reference } = body;

    // Fetch the asset using admin client to avoid timing issues
    const { data: asset, error: fetchError } = await adminClient
      .from("media_assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (fetchError || !asset) {
      console.error(`[Asset Analyze] Asset not found: ${assetId}`, fetchError);
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    console.log(`[Asset Analyze] Found asset: ${asset.filename}, URL: ${asset.public_url}`);

    const isVideo = asset.kind === 'video' || asset.mime_type?.startsWith('video/');

    if (isVideo) {
      // For videos, create a TwelveLabs video job
      console.log(`[Asset Analyze] Creating TwelveLabs video job for video asset`);
      
      // Check if TWELVELABS_API_KEY is configured
      if (!process.env.TWELVELABS_API_KEY) {
        console.log(`[Asset Analyze] TwelveLabs not configured, skipping analysis`);
        await adminClient
          .from("media_assets")
          .update({ 
            status: 'ready',
            metadata: {
              ...(asset.metadata || {}),
              name: asset.filename?.replace(/\.[^/.]+$/, "") || "Untitled",
              analysisSkipped: 'Video analysis service not configured'
            }
          })
          .eq("id", assetId);
        return NextResponse.json({ success: true, skipped: true, reason: "TwelveLabs not configured" });
      }

      // Use the asset's owner_id for the video job (since this is an internal call)
      const userId = asset.owner_id;
      if (!userId) {
        return NextResponse.json({ error: "Asset has no owner" }, { status: 400 });
      }

      // Create a video job
      const { data: job, error: jobError } = await adminClient
        .from("video_jobs")
        .insert({
          user_id: userId,
          asset_url: asset.public_url,
          filename: asset.filename,
          content_type: asset.mime_type,
          duration: asset.duration_sec,
          status: "queued",
          progress: 0,
          metadata: { 
            asset_id: assetId,
            reference: reference || null,
          },
        })
        .select("id")
        .single();

      if (jobError || !job) {
        console.error(`[Asset Analyze] Failed to create video job:`, jobError);
        throw new Error("Failed to create video analysis job");
      }

      // Trigger background processing
      const baseUrl = request.nextUrl.origin;
      const internalSecret = process.env.INTERNAL_WORKER_SECRET;

      if (internalSecret) {
        fetch(`${baseUrl}/api/video-jobs/${job.id}/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": internalSecret,
          },
        }).catch((err) => {
          console.error("Failed to trigger background processing:", err);
        });
      }

      // Update asset status to processing
      await adminClient
        .from("media_assets")
        .update({ 
          status: 'processing',
          metadata: {
            ...(asset.metadata || {}),
            video_job_id: job.id,
            name: asset.filename?.replace(/\.[^/.]+$/, "") || "Untitled",
          }
        })
        .eq("id", assetId);

      const duration = Date.now() - startTime;
      console.log(`[Asset Analyze] Video job created in ${duration}ms for asset ${assetId}`);

      return NextResponse.json({
        success: true,
        videoJobId: job.id,
        message: "Video analysis job created",
        durationMs: duration,
      });

    } else {
      // For images, just set to ready with basic metadata
      console.log(`[Asset Analyze] Image asset - setting to ready with basic metadata`);
      
      await adminClient
        .from("media_assets")
        .update({ 
          status: 'ready',
          metadata: {
            ...(asset.metadata || {}),
            name: asset.filename?.replace(/\.[^/.]+$/, "") || "Untitled",
            analyzedAt: new Date().toISOString(),
          }
        })
        .eq("id", assetId);

      const duration = Date.now() - startTime;
      console.log(`[Asset Analyze] Image metadata set in ${duration}ms for asset ${assetId}`);

      return NextResponse.json({
        success: true,
        name: asset.filename?.replace(/\.[^/.]+$/, "") || "Untitled",
        durationMs: duration,
      });
    }

  } catch (error) {
    console.error(`[Asset Analyze] Error:`, error);
    
    // Update asset status to indicate failure
    try {
      const errorAdminClient = createAdminClient();
      await errorAdminClient
        .from("media_assets")
        .update({ 
          status: 'ready', // Set to ready even on failure so user can still use it
          metadata: {
            analysisError: error instanceof Error ? error.message : 'Unknown error',
            analyzedAt: new Date().toISOString(),
          }
        })
        .eq("id", assetId);
    } catch (updateError) {
      console.error(`[Asset Analyze] Failed to update asset status:`, updateError);
    }

    return NextResponse.json(
      { error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
