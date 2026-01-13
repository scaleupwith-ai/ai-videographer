import * as fs from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";
import { config } from "../config";
import {
  getProject,
  getAssets,
  updateJobProgress,
  updateJobStatus,
  updateProjectOutput,
  TimelineV1,
  Scene,
  MediaAsset,
} from "../db";
import { downloadFromUrl, uploadFile, getFileSize, cleanupDir } from "../storage";
import { buildFFmpegCommand, runFFmpeg, generateThumbnail } from "./ffmpeg";

/**
 * Main render orchestrator
 */
export async function renderProject(
  jobId: string,
  projectId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const workDir = path.join(config.tempDir, jobId);

  try {
    // Mark job as running
    await updateJobStatus(jobId, "running");
    await updateJobProgress(jobId, 0, "Starting render...");

    // Get project and timeline
    const project = await getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const timeline = project.timeline_json as TimelineV1;
    if (!timeline || !timeline.scenes || timeline.scenes.length === 0) {
      throw new Error("Project has no timeline or scenes");
    }

    await updateJobProgress(jobId, 5, "Fetching assets...");

    // Collect all asset IDs from timeline
    const assetIds = new Set<string>();
    for (const scene of timeline.scenes) {
      if (scene.assetId) assetIds.add(scene.assetId);
    }
    if (timeline.global.music.assetId) assetIds.add(timeline.global.music.assetId);
    if (timeline.global.voiceover.assetId) assetIds.add(timeline.global.voiceover.assetId);
    if (timeline.global.brand.logoAssetId) assetIds.add(timeline.global.brand.logoAssetId);

    // Fetch asset metadata
    const assets = await getAssets(Array.from(assetIds));
    await updateJobProgress(jobId, 10, `Found ${assets.size} assets`);

    // Create work directory
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    // Download all assets
    const localAssets = new Map<string, string>();
    let downloadProgress = 10;
    const downloadStep = 30 / Math.max(assets.size, 1);

    for (const [assetId, asset] of assets) {
      if (asset.url) {
        const ext = path.extname(asset.filename) || getExtFromMime(asset.asset_type);
        const localPath = path.join(workDir, `asset_${assetId}${ext}`);

        await updateJobProgress(
          jobId,
          Math.round(downloadProgress),
          `Downloading ${asset.filename}...`
        );

        await downloadFromUrl(asset.url, localPath);
        localAssets.set(assetId, localPath);
        downloadProgress += downloadStep;
      }
    }

    await updateJobProgress(jobId, 40, "Building render graph...");

    // Build FFmpeg command
    const outputPath = path.join(workDir, "output.mp4");
    const ffmpegArgs = buildFFmpegCommand(timeline, localAssets, outputPath);

    await updateJobProgress(jobId, 45, "Rendering video...");

    // Calculate total duration for progress tracking
    const totalDuration = timeline.scenes.reduce((sum, s) => sum + s.durationSec, 0);

    // Run FFmpeg
    await runFFmpeg(ffmpegArgs, (timeSec) => {
      const renderProgress = Math.min(45 + (timeSec / totalDuration) * 45, 90);
      onProgress(renderProgress);
      updateJobProgress(jobId, Math.round(renderProgress));
    });

    await updateJobProgress(jobId, 90, "Generating thumbnail...");

    // Generate thumbnail
    const thumbnailPath = path.join(workDir, "thumbnail.jpg");
    await generateThumbnail(outputPath, thumbnailPath);

    await updateJobProgress(jobId, 92, "Uploading output...");

    // Upload output video
    const outputKey = `renders/${projectId}/${uuid()}.mp4`;
    const outputUrl = await uploadFile(outputPath, outputKey, "video/mp4");

    // Upload thumbnail
    const thumbnailKey = `renders/${projectId}/${uuid()}_thumb.jpg`;
    const thumbnailUrl = await uploadFile(thumbnailPath, thumbnailKey, "image/jpeg");

    const sizeBytes = getFileSize(outputPath);

    await updateJobProgress(jobId, 98, "Finalizing...");

    // Update job as finished
    await updateJobStatus(jobId, "finished", {
      outputUrl,
      thumbnailUrl,
      durationSec: totalDuration,
      sizeBytes,
    });

    // Update project
    await updateProjectOutput(projectId, "finished", {
      outputUrl,
      thumbnailUrl,
      durationSec: totalDuration,
    });

    await updateJobProgress(jobId, 100, "Render complete!");
    onProgress(100);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Render failed:", errorMessage);

    await updateJobStatus(jobId, "failed", { error: errorMessage });
    await updateProjectOutput(projectId, "failed");

    throw error;
  } finally {
    // Clean up work directory
    cleanupDir(workDir);
  }
}

function getExtFromMime(kind: string): string {
  switch (kind) {
    case "video":
      return ".mp4";
    case "image":
      return ".jpg";
    case "audio":
      return ".mp3";
    case "logo":
      return ".png";
    default:
      return "";
  }
}

