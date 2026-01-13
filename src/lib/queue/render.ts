import { Queue } from "bullmq";

// Redis connection config (lazy initialization)
let renderQueue: Queue | null = null;

function getRenderQueue(): Queue {
  if (!renderQueue) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
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
  
  console.log("Enqueueing render job:", payload.jobId);
  
  // Add with timeout to prevent hanging
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Redis connection timeout")), 10000);
  });
  
  await Promise.race([
    queue.add("render-video", payload, {
      jobId: payload.jobId,
    }),
    timeoutPromise,
  ]);
  
  console.log("Render job enqueued successfully");
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

