import { Queue } from "bullmq";
import { BatchClient, SubmitJobCommand } from "@aws-sdk/client-batch";

// Redis connection config (lazy initialization)
let renderQueue: Queue | null = null;
let redisAvailable = true;

// AWS Batch client (lazy initialization)
let batchClient: BatchClient | null = null;

function getBatchClient(): BatchClient | null {
  const useAwsBatch = process.env.USE_AWS_BATCH === "true";
  if (!useAwsBatch) return null;
  
  if (!batchClient) {
    batchClient = new BatchClient({
      region: process.env.AWS_REGION || "ap-southeast-2",
    });
  }
  return batchClient;
}

function getRenderQueue(): Queue | null {
  if (!redisAvailable) return null;
  
  if (!renderQueue) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.warn("REDIS_URL not configured, using direct worker call");
      redisAvailable = false;
      return null;
    }
    
    try {
      const url = new URL(redisUrl);
      const useTls = redisUrl.startsWith("rediss://");
      
      console.log("Connecting to Redis:", url.hostname, "TLS:", useTls);
      
      renderQueue = new Queue("render", {
        connection: {
          host: url.hostname,
          port: parseInt(url.port || "6379"),
          password: url.password || undefined,
          username: url.username || "default",
          maxRetriesPerRequest: null,
          ...(useTls ? { tls: {} } : {}),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: {
            age: 24 * 3600,
          },
          removeOnFail: {
            age: 7 * 24 * 3600,
          },
        },
      });
    } catch (error) {
      console.error("Failed to create Redis queue:", error);
      redisAvailable = false;
      return null;
    }
  }
  return renderQueue;
}

export interface RenderJobPayload {
  jobId: string;
  projectId: string;
}

/**
 * Submit job to AWS Batch
 * 
 * CRITICAL: JOB_ID and PROJECT_ID are passed as container overrides
 * The batch-job.ts entry point reads these from process.env
 */
async function submitBatchJob(payload: RenderJobPayload): Promise<string> {
  const client = getBatchClient();
  if (!client) {
    throw new Error("AWS Batch not configured");
  }
  
  const jobQueue = process.env.AWS_BATCH_JOB_QUEUE || "ai-videographer-render-queue";
  const jobDefinition = process.env.AWS_BATCH_JOB_DEFINITION || "ai-videographer-render";
  
  // Generate a unique job name (max 128 chars, alphanumeric + hyphens only)
  const jobName = `render-${payload.projectId.slice(0, 8)}-${Date.now()}`;
  
  console.log("=".repeat(60));
  console.log("[Queue] Submitting job to AWS Batch");
  console.log(`[Queue] Job Queue: ${jobQueue}`);
  console.log(`[Queue] Job Definition: ${jobDefinition}`);
  console.log(`[Queue] Job Name: ${jobName}`);
  console.log(`[Queue] JOB_ID (render_jobs.id): ${payload.jobId}`);
  console.log(`[Queue] PROJECT_ID (projects.id): ${payload.projectId}`);
  console.log("=".repeat(60));
  
  const command = new SubmitJobCommand({
    jobName,
    jobQueue,
    jobDefinition,
    containerOverrides: {
      // CRITICAL: These environment variables are read by batch-job.ts
      environment: [
        { name: "JOB_ID", value: payload.jobId },
        { name: "PROJECT_ID", value: payload.projectId },
      ],
    },
    retryStrategy: {
      attempts: 2,
    },
  });
  
  const response = await client.send(command);
  
  if (!response.jobId) {
    console.error("[Queue] AWS Batch did not return a job ID");
    throw new Error("AWS Batch did not return a job ID");
  }
  
  console.log(`[Queue] AWS Batch job submitted successfully`);
  console.log(`[Queue] AWS Batch Job ID: ${response.jobId}`);
  console.log(`[Queue] Job ARN: ${response.jobArn || 'N/A'}`);
  
  return response.jobId;
}

/**
 * Call worker directly via HTTP (legacy/fallback)
 */
async function callWorkerDirectly(payload: RenderJobPayload): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  
  if (!workerUrl) {
    console.log("WORKER_URL not configured, job queued in database only");
    return;
  }
  
  console.log("Calling worker directly:", workerUrl);
  
  const response = await fetch(`${workerUrl}/render`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.WORKER_SECRET || ""}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Worker returned ${response.status}`);
  }
  
  console.log("Worker acknowledged job");
}

/**
 * Enqueue a render job for the worker to process
 * 
 * Priority order:
 * 1. AWS Batch (if USE_AWS_BATCH=true) - serverless, scales to zero
 * 2. Redis/BullMQ (if REDIS_URL set) - for dedicated workers
 * 3. Direct HTTP call (if WORKER_URL set) - for single EC2 worker
 * 4. Database only - worker polls for jobs
 */
export async function enqueueRenderJob(payload: RenderJobPayload): Promise<void> {
  console.log("Enqueueing render job:", payload.jobId);
  
  // Try AWS Batch first (preferred for production)
  const batchClient = getBatchClient();
  if (batchClient) {
    try {
      const batchJobId = await submitBatchJob(payload);
      console.log(`Render job submitted to AWS Batch: ${batchJobId}`);
      return;
    } catch (error) {
      console.error("AWS Batch submission failed:", error);
      // Fall through to other methods
    }
  }
  
  // Try Redis queue
  const queue = getRenderQueue();
  if (queue) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Redis connection timeout")), 5000);
      });
      
      await Promise.race([
        queue.add("render-video", payload, {
          jobId: payload.jobId,
        }),
        timeoutPromise,
      ]);
      
      console.log("Render job enqueued to Redis successfully");
      return;
    } catch (error) {
      console.error("Redis enqueue failed, falling back to direct call:", error);
      redisAvailable = false;
    }
  }
  
  // Fallback to direct HTTP call
  try {
    await callWorkerDirectly(payload);
  } catch (error) {
    console.error("Direct worker call also failed:", error);
    // Job is already in database with "queued" status
    // Worker polling will pick it up
    console.log("Job saved to database, worker will poll for it");
  }
}

/**
 * Get render queue stats (for monitoring)
 */
export async function getRenderQueueStats() {
  const queue = getRenderQueue();
  
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

