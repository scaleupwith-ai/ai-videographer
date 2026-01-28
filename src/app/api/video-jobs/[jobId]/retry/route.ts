import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/video-jobs/[jobId]/retry
 * Retry a failed video job
 *
 * Only allowed if status is 'failed'
 * Resets status to 'queued' and triggers processing
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Fetch job to verify ownership and status
    const { data: job, error: fetchError } = await supabase
      .from("video_jobs")
      .select("id, status, user_id")
      .eq("id", jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify ownership
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Only allow retry if failed
    if (job.status !== "failed") {
      return NextResponse.json(
        { error: "Can only retry failed jobs" },
        { status: 400 }
      );
    }

    // Reset job status using admin client
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from("video_jobs")
      .update({
        status: "queued",
        progress: 0,
        error: null,
        // Keep provider_task_id for idempotency - process will check if task is still valid
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Error resetting job status:", updateError);
      return NextResponse.json(
        { error: "Failed to reset job" },
        { status: 500 }
      );
    }

    // Trigger background processing
    const baseUrl = request.nextUrl.origin;
    const internalSecret = process.env.INTERNAL_WORKER_SECRET;

    if (internalSecret) {
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

    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    console.error("Error in POST /api/video-jobs/[jobId]/retry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

