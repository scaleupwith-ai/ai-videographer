/**
 * AWS Batch Job Entry Point
 * 
 * This script runs as a single-execution job in AWS Batch.
 * It receives projectId and renderJobId from environment variables,
 * performs the render, and exits.
 * 
 * Environment variables (from container overrides via Batch):
 * - JOB_ID: The render job ID (UUID from render_jobs table)
 * - PROJECT_ID: The project ID (UUID from projects table)
 * 
 * Environment variables (from SSM Parameter Store via job definition):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_ENDPOINT
 * - R2_BUCKET
 * - R2_PUBLIC_URL
 */

import "dotenv/config";
import { renderProject } from "./render/renderProject";
import { updateJobStatus, updateJobProgress } from "./db";

// Progress checkpoints for granular updates
const PROGRESS_CHECKPOINTS = {
  STARTING: 0,
  FETCHING_PROJECT: 5,
  DOWNLOADING_ASSETS: 10,
  ASSETS_DOWNLOADED: 40,
  BUILDING_RENDER_GRAPH: 45,
  RENDERING_VIDEO: 50,
  RENDERING_COMPLETE: 90,
  GENERATING_THUMBNAIL: 92,
  UPLOADING_OUTPUT: 95,
  FINALIZING: 98,
  COMPLETE: 100,
} as const;

async function main() {
  const jobId = process.env.JOB_ID;
  const projectId = process.env.PROJECT_ID;

  // Log all relevant environment info for debugging
  console.log("=".repeat(60));
  console.log("[Batch] AWS Batch Job Starting");
  console.log("=".repeat(60));
  console.log(`[Batch] JOB_ID: ${jobId || 'NOT SET'}`);
  console.log(`[Batch] PROJECT_ID: ${projectId || 'NOT SET'}`);
  console.log(`[Batch] AWS_BATCH_JOB_ID: ${process.env.AWS_BATCH_JOB_ID || 'NOT SET (local mode)'}`);
  console.log(`[Batch] AWS_BATCH_JOB_ATTEMPT: ${process.env.AWS_BATCH_JOB_ATTEMPT || 'NOT SET'}`);
  console.log(`[Batch] SUPABASE_URL: ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`[Batch] R2_BUCKET: ${process.env.R2_BUCKET || 'NOT SET'}`);
  console.log("=".repeat(60));

  if (!jobId || !projectId) {
    console.error("[Batch] FATAL: Missing required environment variables");
    console.error("[Batch] JOB_ID and PROJECT_ID must be passed as container overrides");
    console.error("[Batch] Check that the Next.js render route is passing these correctly");
    process.exit(1);
  }

  try {
    // Checkpoint: Starting
    console.log(`[Batch] Checkpoint: STARTING (${PROGRESS_CHECKPOINTS.STARTING}%)`);
    await updateJobStatus(jobId, "running");
    await updateJobProgress(jobId, PROGRESS_CHECKPOINTS.STARTING, "Starting render in AWS Batch...");

    // Checkpoint: Fetching project
    console.log(`[Batch] Checkpoint: FETCHING_PROJECT (${PROGRESS_CHECKPOINTS.FETCHING_PROJECT}%)`);
    await updateJobProgress(jobId, PROGRESS_CHECKPOINTS.FETCHING_PROJECT, "Fetching project data...");

    // Run the render with progress callback
    let lastReportedProgress = 0;
    await renderProject(jobId, projectId, (progress) => {
      // Only log when progress changes by at least 5%
      const rounded = Math.round(progress / 5) * 5;
      if (rounded !== lastReportedProgress) {
        lastReportedProgress = rounded;
        console.log(`[Batch] Render progress: ${rounded}%`);
      }
    });

    // Checkpoint: Complete
    console.log(`[Batch] Checkpoint: COMPLETE (${PROGRESS_CHECKPOINTS.COMPLETE}%)`);
    console.log("=".repeat(60));
    console.log(`[Batch] Render completed successfully`);
    console.log(`[Batch] Job ID: ${jobId}`);
    console.log(`[Batch] Project ID: ${projectId}`);
    console.log("=".repeat(60));
    
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    
    console.error("=".repeat(60));
    console.error(`[Batch] RENDER FAILED`);
    console.error(`[Batch] Job ID: ${jobId}`);
    console.error(`[Batch] Error: ${errorMessage}`);
    console.error(`[Batch] Stack: ${errorStack}`);
    console.error("=".repeat(60));
    
    // Update job status to failed
    try {
      await updateJobStatus(jobId, "failed", { error: errorMessage });
      await updateJobProgress(jobId, lastReportedProgress || 0, `Failed: ${errorMessage}`);
    } catch (updateError) {
      console.error("[Batch] Failed to update job status:", updateError);
    }
    
    process.exit(1);
  }
}

// Track progress for error reporting
let lastReportedProgress = 0;

main().catch((error) => {
  console.error("[Batch] Unhandled error in main():", error);
  process.exit(1);
});





