import { Queue } from "bullmq";

// Redis connection config (lazy initialization)
let renderQueue: Queue | null = null;

function getRenderQueue(): Queue {
  if (!renderQueue) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    renderQueue = new Queue("render", {
      connection: {
        host: redisUrl.includes("://") ? new URL(redisUrl).hostname : "localhost",
        port: redisUrl.includes("://") ? parseInt(new URL(redisUrl).port || "6379") : 6379,
        password: redisUrl.includes("://") ? new URL(redisUrl).password || undefined : undefined,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return renderQueue;
}

export interface RenderJobPayload {
  jobId: string;
  projectId: string;
}

/**
 * Enqueue a render job for the worker to process
 */
export async function enqueueRenderJob(payload: RenderJobPayload): Promise<void> {
  const queue = getRenderQueue();
  
  await queue.add("render-video", payload, {
    jobId: payload.jobId, // Use DB job ID as BullMQ job ID for deduplication
  });
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

