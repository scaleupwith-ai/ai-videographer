import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import express, { Request, Response } from "express";
import { renderProject } from "./render/renderProject";
import { generateRenditions } from "./render/generateRenditions";
import { getQueuedJobs, updateJobStatus } from "./db";

const PORT = parseInt(process.env.PORT || "3001");
const WORKER_SECRET = process.env.WORKER_SECRET || "";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "30000"); // 30 seconds

interface RenderJobPayload {
  jobId: string;
  projectId: string;
}

let isProcessing = false;
let redisConnected = false;

// Try to connect to Redis
let connection: IORedis | null = null;
let worker: Worker<RenderJobPayload> | null = null;

async function initRedis() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log("REDIS_URL not configured, using database polling only");
    return;
  }
  
  try {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("Redis connection failed after 3 attempts, falling back to polling");
          return null;
        }
        return Math.min(times * 1000, 3000);
      },
    });
    
    connection.on("connect", () => {
      console.log("Connected to Redis");
      redisConnected = true;
    });
    
    connection.on("error", (error) => {
      console.error("Redis connection error:", error.message);
      redisConnected = false;
    });

    // Create worker
    worker = new Worker<RenderJobPayload>(
      "render",
      async (job: Job<RenderJobPayload>) => {
        console.log(`[Redis] Processing render job ${job.data.jobId} for project ${job.data.projectId}`);
        
        try {
          isProcessing = true;
          await renderProject(job.data.jobId, job.data.projectId, (progress) => {
            job.updateProgress(progress);
          });
          
          console.log(`[Redis] Completed render job ${job.data.jobId}`);
        } catch (error) {
          console.error(`[Redis] Failed render job ${job.data.jobId}:`, error);
          throw error;
        } finally {
          isProcessing = false;
        }
      },
      {
        connection,
        concurrency: 1,
        limiter: {
          max: 2,
          duration: 60000,
        },
      }
    );

    worker.on("completed", (job) => {
      console.log(`[Redis] Job ${job.id} completed successfully`);
    });

    worker.on("failed", (job, error) => {
      console.error(`[Redis] Job ${job?.id} failed:`, error.message);
    });

    worker.on("error", (error) => {
      console.error("[Redis] Worker error:", error);
    });
    
  } catch (error) {
    console.error("Failed to initialize Redis:", error);
  }
}

// Process a single job
async function processJob(jobId: string, projectId: string) {
  if (isProcessing) {
    console.log("Already processing a job, skipping");
    return false;
  }
  
  console.log(`[Direct] Processing render job ${jobId} for project ${projectId}`);
  
  try {
    isProcessing = true;
    await renderProject(jobId, projectId, () => {});
    console.log(`[Direct] Completed render job ${jobId}`);
    return true;
  } catch (error) {
    console.error(`[Direct] Failed render job ${jobId}:`, error);
    return false;
  } finally {
    isProcessing = false;
  }
}

// Database polling for queued jobs
async function pollDatabase() {
  if (isProcessing) return;
  
  try {
    const jobs = await getQueuedJobs(1);
    
    for (const job of jobs) {
      if (isProcessing) break;
      
      console.log(`[Poll] Found queued job: ${job.id}`);
      
      // Mark as running before processing
      await updateJobStatus(job.id, "running");
      
      await processJob(job.id, job.project_id);
    }
  } catch (error) {
    console.error("[Poll] Error polling database:", error);
  }
}

// Start polling
function startPolling() {
  console.log(`Starting database polling every ${POLL_INTERVAL}ms`);
  
  setInterval(async () => {
    // Only poll if Redis is not working
    if (!redisConnected || !worker) {
      await pollDatabase();
    }
  }, POLL_INTERVAL);
  
  // Initial poll
  setTimeout(pollDatabase, 5000);
}

// HTTP server for direct calls
const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    redis: redisConnected,
    processing: isProcessing,
  });
});

// Render endpoint
app.post("/render", async (req: Request, res: Response) => {
  // Verify secret
  const authHeader = req.headers.authorization;
  if (WORKER_SECRET && authHeader !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { jobId, projectId } = req.body;
  
  if (!jobId || !projectId) {
    return res.status(400).json({ error: "jobId and projectId required" });
  }
  
  console.log(`[HTTP] Received render request for job ${jobId}`);
  
  // Process async - don't wait
  processJob(jobId, projectId).catch(console.error);
  
  res.json({ status: "accepted", jobId });
});

// Generate renditions endpoint - creates lower resolution versions of clips
app.post("/generate-renditions", async (req: Request, res: Response) => {
  const { clipId, sourceUrl, sourceResolution, targetResolutions, duration } = req.body;
  
  if (!clipId || !sourceUrl || !targetResolutions || targetResolutions.length === 0) {
    return res.status(400).json({ error: "clipId, sourceUrl, and targetResolutions required" });
  }
  
  console.log(`[Renditions] Generating ${targetResolutions.join(", ")} for clip ${clipId}`);
  
  // Process async - don't wait
  generateRenditions(clipId, sourceUrl, targetResolutions)
    .then((results) => console.log(`[Renditions] Completed for ${clipId}:`, results))
    .catch((error) => console.error(`[Renditions] Failed for ${clipId}:`, error));
  
  res.json({ 
    status: "accepted", 
    clipId,
    targetResolutions,
    jobId: clipId, // Using clipId as jobId for simplicity
  });
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down gracefully...");
  
  if (worker) {
    await worker.close();
  }
  if (connection) {
    await connection.quit();
  }
  
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start
async function main() {
  await initRedis();
  startPolling();
  
  app.listen(PORT, () => {
    console.log(`Render worker started on port ${PORT}`);
    console.log(`Redis: ${redisConnected ? "connected" : "not connected"}`);
    console.log("Waiting for jobs...");
  });
}

main().catch(console.error);
