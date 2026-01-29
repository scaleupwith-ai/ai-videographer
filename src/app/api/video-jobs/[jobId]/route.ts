import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/video-jobs/[jobId]
 * Get status of a specific video job
 *
 * Returns: { jobId, status, progress?, resultJson?, error? }
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch job (RLS will ensure user can only see their own jobs)
    const { data: job, error: fetchError } = await supabase
      .from("video_jobs")
      .select(
        "id, status, progress, result_json, error, asset_url, filename, created_at, updated_at"
      )
      .eq("id", jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      resultJson: job.result_json,
      error: job.error,
      assetUrl: job.asset_url,
      filename: job.filename,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    });
  } catch (error) {
    console.error("Error in GET /api/video-jobs/[jobId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


