import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/video-jobs
 * Create a new video processing job
 *
 * Body: { assetUrl: string, filename?: string, contentType?: string, duration?: number, metadata?: object }
 * Returns: { jobId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { assetUrl, filename, contentType, duration, metadata } = body;

    if (!assetUrl) {
      return NextResponse.json(
        { error: "assetUrl is required" },
        { status: 400 }
      );
    }

    // Create job in database with queued status
    const adminClient = createAdminClient();
    const { data: job, error: insertError } = await adminClient
      .from("video_jobs")
      .insert({
        user_id: user.id,
        asset_url: assetUrl,
        filename: filename || null,
        content_type: contentType || null,
        duration: duration || null,
        status: "queued",
        progress: 0,
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (insertError || !job) {
      console.error("Error creating video job:", insertError);
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
      );
    }

    const jobId = job.id;

    // Trigger background processing (fire-and-forget)
    // Using internal worker endpoint with secret
    const baseUrl = request.nextUrl.origin;
    const internalSecret = process.env.INTERNAL_WORKER_SECRET;

    if (!internalSecret) {
      console.error("INTERNAL_WORKER_SECRET not configured");
      // Job is created, but processing won't start automatically
      // Could be retried manually later
    } else {
      // Fire and forget - don't await
      fetch(`${baseUrl}/api/video-jobs/${jobId}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": internalSecret,
        },
      }).catch((err) => {
        console.error("Failed to trigger background processing:", err);
      });
    }

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Error in POST /api/video-jobs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/video-jobs
 * List user's video jobs
 *
 * Query params: status?, limit?, offset?
 * Returns: { jobs: VideoJob[] }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = supabase
      .from("video_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: jobs, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching video jobs:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error) {
    console.error("Error in GET /api/video-jobs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


