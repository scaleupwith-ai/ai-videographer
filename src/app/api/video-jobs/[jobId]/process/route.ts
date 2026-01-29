import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createIndexingTaskFromUrl,
  getTaskStatus,
  waitForTaskCompletion,
  analyzeIndexedVideo,
  getOrCreateDefaultIndex,
} from "@/lib/twelvelabs";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/video-jobs/[jobId]/process
 * Internal endpoint for processing a video job
 *
 * Protected by X-Internal-Secret header
 * Must be idempotent: handles resume if providerTaskId exists
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // Verify internal secret
  const internalSecret = process.env.INTERNAL_WORKER_SECRET;
  const providedSecret = request.headers.get("X-Internal-Secret");

  if (!internalSecret || providedSecret !== internalSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const adminClient = createAdminClient();

  try {
    // Fetch job
    const { data: job, error: fetchError } = await adminClient
      .from("video_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (fetchError || !job) {
      console.error(`Job ${jobId} not found:`, fetchError);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Idempotency: If already done, exit
    if (job.status === "done") {
      console.log(`Job ${jobId} is already done, skipping`);
      return NextResponse.json({ status: "already_done" });
    }

    // Helper to update job status
    async function updateJob(updates: Record<string, unknown>) {
      const { error } = await adminClient
        .from("video_jobs")
        .update(updates)
        .eq("id", jobId);

      if (error) {
        console.error(`Failed to update job ${jobId}:`, error);
      }
    }

    // Update status to processing
    await updateJob({ status: "processing", progress: 5 });

    let taskId = job.provider_task_id;
    let videoId: string | null = null;

    // If we already have a provider task ID, check its status (resume)
    if (taskId) {
      console.log(`Job ${jobId}: Resuming with existing task ${taskId}`);
      
      try {
        const existingTask = await getTaskStatus(taskId);
        
        if (existingTask.status === "ready" && existingTask.video_id) {
          // Task already completed, just need to run analysis
          videoId = existingTask.video_id;
          await updateJob({ progress: 70 });
        } else if (existingTask.status === "failed") {
          // Task failed, need to create new one
          console.log(`Job ${jobId}: Previous task failed, creating new one`);
          taskId = null;
        } else {
          // Task still in progress, continue waiting
          console.log(`Job ${jobId}: Task ${taskId} still in progress`);
        }
      } catch (err) {
        // Task not found or error, create new one
        console.log(`Job ${jobId}: Could not fetch task ${taskId}, creating new one`);
        taskId = null;
      }
    }

    // Create new indexing task if needed
    if (!taskId) {
      console.log(`Job ${jobId}: Creating new TwelveLabs indexing task`);
      
      const indexId = await getOrCreateDefaultIndex();
      await updateJob({ progress: 10 });

      const task = await createIndexingTaskFromUrl(job.asset_url, indexId);
      taskId = task._id;

      // Store provider task ID for idempotency
      await updateJob({ provider_task_id: taskId, progress: 15 });
      console.log(`Job ${jobId}: Created task ${taskId}`);
    }

    // Wait for indexing to complete (if not already done)
    if (!videoId) {
      console.log(`Job ${jobId}: Waiting for indexing to complete`);
      
      const completedTask = await waitForTaskCompletion(taskId, {
        pollIntervalMs: 5000,
        timeoutMs: 600000, // 10 minutes
        onProgress: async (task) => {
          const percentage = task.process?.percentage || 0;
          // Map 0-100 indexing progress to 15-70 overall progress
          const mappedProgress = 15 + Math.round(percentage * 0.55);
          await updateJob({ progress: mappedProgress });
        },
      });

      videoId = completedTask.video_id ?? null;
      if (!videoId) {
        throw new Error("Indexing completed but no video ID returned");
      }
    }

    await updateJob({ progress: 75 });
    console.log(`Job ${jobId}: Indexing complete, videoId=${videoId}. Running analysis...`);

    // Perform comprehensive analysis
    const analysis = await analyzeIndexedVideo(videoId);

    // Save results - spread analysis first so our videoId and taskId don't get overwritten
    await updateJob({
      status: "done",
      progress: 100,
      result_json: {
        ...analysis,
        taskId,
      },
    });

    // If this job was triggered from an asset, update the asset's metadata with the AI description
    const assetId = job.metadata?.asset_id;
    if (assetId && analysis.summary) {
      console.log(`Job ${jobId}: Updating asset ${assetId} with AI-generated description`);
      
      // Fetch current asset metadata
      const { data: asset } = await adminClient
        .from("media_assets")
        .select("metadata")
        .eq("id", assetId)
        .single();
      
      // Merge AI results into asset metadata
      const updatedMetadata = {
        ...(asset?.metadata || {}),
        description: analysis.summary,
        aiGenerated: true,
        analyzedAt: new Date().toISOString(),
        videoJobId: jobId,
        chapters: analysis.chapters,
        highlights: analysis.highlights,
      };

      // Update the asset
      await adminClient
        .from("media_assets")
        .update({ 
          status: 'ready',
          metadata: updatedMetadata,
        })
        .eq("id", assetId);
      
      console.log(`Job ${jobId}: Asset ${assetId} updated with AI description`);
    }

    console.log(`Job ${jobId}: Processing complete`);
    return NextResponse.json({ status: "done", videoId });

  } catch (error) {
    console.error(`Job ${jobId} processing failed:`, error);

    // Update job with error
    await adminClient
      .from("video_jobs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", jobId);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

