import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { renderProject } from "./render/renderProject";

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

interface RenderJobPayload {
  jobId: string;
  projectId: string;
}

// Create worker
const worker = new Worker<RenderJobPayload>(
  "render",
  async (job: Job<RenderJobPayload>) => {
    console.log(`Processing render job ${job.data.jobId} for project ${job.data.projectId}`);
    
    try {
      await renderProject(job.data.jobId, job.data.projectId, (progress) => {
        job.updateProgress(progress);
      });
      
      console.log(`Completed render job ${job.data.jobId}`);
    } catch (error) {
      console.error(`Failed render job ${job.data.jobId}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Process one render at a time
    limiter: {
      max: 2,
      duration: 60000, // Max 2 jobs per minute
    },
  }
);

// Event handlers
worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log("Render worker started, waiting for jobs...");

