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

// Progress checkpoint constants for consistent UI updates
const PROGRESS = {
  STARTING: 0,
  FETCHING_PROJECT: 5,
  PREPARING_DOWNLOADS: 10,
  DOWNLOADING_ASSETS: 15,  // 15-40 for downloads
  BUILDING_RENDER_GRAPH: 42,
  RENDERING_START: 45,     // 45-88 for FFmpeg render
  GENERATING_THUMBNAIL: 90,
  UPLOADING_OUTPUT: 93,
  UPLOADING_THUMBNAIL: 96,
  FINALIZING: 98,
  COMPLETE: 100,
} as const;

/**
 * Main render orchestrator
 * 
 * Progress checkpoints:
 * 0%   - Starting
 * 5%   - Fetching project data
 * 10%  - Preparing downloads
 * 15-40% - Downloading assets
 * 42%  - Building render graph
 * 45-88% - FFmpeg rendering
 * 90%  - Generating thumbnail
 * 93%  - Uploading video
 * 96%  - Uploading thumbnail
 * 98%  - Finalizing
 * 100% - Complete
 */
export async function renderProject(
  jobId: string,
  projectId: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const workDir = path.join(config.tempDir, jobId);

  try {
    // Checkpoint: Starting
    console.log(`[Render] Starting render for job ${jobId}, project ${projectId}`);
    await updateJobStatus(jobId, "running");
    await updateJobProgress(jobId, PROGRESS.STARTING, "Starting render...");
    onProgress(PROGRESS.STARTING);

    // Checkpoint: Fetching project
    console.log("[Render] Checkpoint: Fetching project data");
    await updateJobProgress(jobId, PROGRESS.FETCHING_PROJECT, "Fetching project data...");
    onProgress(PROGRESS.FETCHING_PROJECT);

    // Get project and timeline
    const project = await getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const timeline = project.timeline_json as TimelineV1;
    if (!timeline || !timeline.scenes || timeline.scenes.length === 0) {
      throw new Error("Project has no timeline or scenes");
    }

    console.log(`[Render] Project loaded: ${project.title}, ${timeline.scenes.length} scenes`);

    // Checkpoint: Preparing downloads
    console.log("[Render] Checkpoint: Preparing downloads");
    await updateJobProgress(jobId, PROGRESS.PREPARING_DOWNLOADS, "Preparing downloads...");
    onProgress(PROGRESS.PREPARING_DOWNLOADS);

    // Create work directory
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    // Collect items to download:
    // 1. Scenes with clipUrl (b-roll from clips table) - download directly
    // 2. Scenes with assetId (user assets from media_assets) - fetch metadata first
    // 3. Global assets (voiceover from media_assets, music from audioUrl, logo)
    
    const directDownloads: { id: string; url: string; name: string; type?: 'video' | 'audio' | 'image' }[] = [];
    const assetIds = new Set<string>();

    for (const scene of timeline.scenes) {
      if (scene.clipUrl) {
        // B-roll clip: download directly via clipUrl
        directDownloads.push({
          id: scene.clipId || scene.id,
          url: scene.clipUrl,
          name: `Clip ${scene.id}`,
          type: 'video',
        });
      } else if (scene.assetId) {
        // User asset: need to fetch from media_assets
        assetIds.add(scene.assetId);
      }
    }

    // Music: download directly from audioUrl (not from media_assets)
    // The music table stores audio_url directly
    const musicData = timeline.global?.music as { assetId?: string; audioUrl?: string; volume?: number; title?: string } | undefined;
    console.log("[MUSIC DEBUG] Raw music data from timeline:", JSON.stringify(musicData));
    
    if (musicData?.audioUrl) {
      const musicId = musicData.assetId || "music";
      console.log(`[MUSIC DEBUG] Adding music to download queue:`, {
        id: musicId,
        title: musicData.title,
        url: musicData.audioUrl,
        volume: musicData.volume,
      });
      directDownloads.push({
        id: musicId,
        url: musicData.audioUrl,
        name: `Background Music: ${musicData.title || 'Unknown'}`,
        type: 'audio',
      });
    } else {
      console.error("[MUSIC DEBUG] No music audioUrl found in timeline! Full global object:", JSON.stringify(timeline.global));
    }
    
    // Sound effects: download directly from audioUrl
    if (timeline.soundEffects && timeline.soundEffects.length > 0) {
      console.log(`Adding ${timeline.soundEffects.length} sound effects to download queue`);
      for (const sfx of timeline.soundEffects) {
        if (sfx.audioUrl) {
          directDownloads.push({
            id: sfx.id,
            url: sfx.audioUrl,
            name: `SFX: ${sfx.title}`,
            type: 'audio',
          });
        }
      }
    }
    
    // Image overlays: download directly from imageUrl
    if (timeline.imageOverlays && timeline.imageOverlays.length > 0) {
      console.log(`Adding ${timeline.imageOverlays.length} image overlays to download queue`);
      for (const io of timeline.imageOverlays) {
        if (io.imageUrl) {
          directDownloads.push({
            id: io.id,
            url: io.imageUrl,
            name: `Overlay: ${io.title}`,
            type: 'image',
          });
        }
      }
    }

    // Voiceover: fetch from media_assets
    if (timeline.global.voiceover?.assetId) assetIds.add(timeline.global.voiceover.assetId);
    
    // Logo: fetch from media_assets
    if (timeline.global.brand?.logoAssetId) assetIds.add(timeline.global.brand.logoAssetId);
    
    // Audio tracks (for talking head videos): fetch from media_assets
    if (timeline.audioTracks && timeline.audioTracks.length > 0) {
      console.log(`Adding ${timeline.audioTracks.length} audio tracks to asset queue`);
      for (const track of timeline.audioTracks) {
        if (track.assetId) {
          assetIds.add(track.assetId);
        }
      }
    }

    // Fetch asset metadata for user assets
    const assets = assetIds.size > 0 ? await getAssets(Array.from(assetIds)) : new Map<string, MediaAsset>();
    
    const totalDownloads = directDownloads.length + assets.size;
    console.log(`[Render] Checkpoint: Downloading ${totalDownloads} assets`);
    await updateJobProgress(jobId, PROGRESS.DOWNLOADING_ASSETS, `Downloading ${totalDownloads} files...`);
    onProgress(PROGRESS.DOWNLOADING_ASSETS);

    // Download all files
    // Progress range: DOWNLOADING_ASSETS (15%) to BUILDING_RENDER_GRAPH (42%)
    const localAssets = new Map<string, string>();
    const downloadProgressRange = PROGRESS.BUILDING_RENDER_GRAPH - PROGRESS.DOWNLOADING_ASSETS; // 27%
    let downloadProgress = PROGRESS.DOWNLOADING_ASSETS;
    const downloadStep = downloadProgressRange / Math.max(totalDownloads, 1);
    let downloadCount = 0;

    // Download direct downloads (clips, music, sfx, overlays)
    for (const download of directDownloads) {
      // Determine extension from type first, then URL
      let ext = ".mp4";
      const url = download.url.toLowerCase();
      
      // Use explicit type if provided
      if (download.type === 'audio') {
        ext = url.includes(".wav") ? ".wav" : ".mp3";
      } else if (download.type === 'image') {
        if (url.includes(".jpg") || url.includes(".jpeg")) ext = ".jpg";
        else if (url.includes(".gif")) ext = ".gif";
        else if (url.includes(".webp")) ext = ".webp";
        else ext = ".png";
      } else if (download.type === 'video') {
        if (url.includes(".webm")) ext = ".webm";
        else if (url.includes(".mov")) ext = ".mov";
        else ext = ".mp4";
      } else {
        // Fallback: detect from URL or name
        if (url.includes(".mp3") || download.name.includes("Music") || download.name.includes("SFX")) {
          ext = ".mp3";
        } else if (url.includes(".wav")) {
          ext = ".wav";
        } else if (url.includes(".png") || download.name.includes("Overlay")) {
          ext = ".png";
        } else if (url.includes(".jpg") || url.includes(".jpeg")) {
          ext = ".jpg";
        } else if (url.includes(".gif")) {
          ext = ".gif";
        } else if (url.includes(".webp")) {
          ext = ".webp";
        }
      }
      const localPath = path.join(workDir, `asset_${download.id}${ext}`);
      console.log(`Downloading ${download.name} (${download.type || 'unknown'}) to ${localPath}`);
      console.log(`  URL: ${download.url}`);

      downloadCount++;
      const currentProgress = Math.round(downloadProgress);
      
      await updateJobProgress(
        jobId,
        currentProgress,
        `Downloading (${downloadCount}/${totalDownloads}): ${download.name}...`
      );
      onProgress(currentProgress);

      try {
        await downloadFromUrl(download.url, localPath);
      } catch (downloadError) {
        console.error(`Failed to download ${download.name}: ${download.url}`);
        throw downloadError;
      }
      // Map by id for lookup in ffmpeg
      localAssets.set(download.id, localPath);
      downloadProgress += downloadStep;
    }

    // Download user assets from media_assets
    for (const [assetId, asset] of assets) {
      if (asset.public_url) {
        const ext = path.extname(asset.filename) || getExtFromMime(asset.kind);
        const localPath = path.join(workDir, `asset_${assetId}${ext}`);

        console.log(`Downloading user asset ${asset.filename}`);
        console.log(`  URL: ${asset.public_url}`);

        downloadCount++;
        const currentProgress = Math.round(downloadProgress);
        
        await updateJobProgress(
          jobId,
          currentProgress,
          `Downloading (${downloadCount}/${totalDownloads}): ${asset.filename}...`
        );
        onProgress(currentProgress);

        try {
          await downloadFromUrl(asset.public_url, localPath);
        } catch (downloadError) {
          console.error(`Failed to download user asset ${asset.filename}: ${asset.public_url}`);
          throw downloadError;
        }
        localAssets.set(assetId, localPath);
        downloadProgress += downloadStep;
      }
    }
    
    console.log(`[Render] Downloaded ${downloadCount} assets successfully`);

    // Checkpoint: Building render graph
    console.log("[Render] Checkpoint: Building render graph");
    await updateJobProgress(jobId, PROGRESS.BUILDING_RENDER_GRAPH, "Building render graph...");
    onProgress(PROGRESS.BUILDING_RENDER_GRAPH);

    // Build FFmpeg command
    const outputPath = path.join(workDir, "output.mp4");
    const ffmpegArgs = buildFFmpegCommand(timeline, localAssets, outputPath);

    // Checkpoint: Starting FFmpeg render
    console.log("[Render] Checkpoint: Starting FFmpeg render");
    await updateJobProgress(jobId, PROGRESS.RENDERING_START, "Rendering video...");
    onProgress(PROGRESS.RENDERING_START);

    // Calculate total duration for progress tracking
    const totalDuration = timeline.scenes.reduce((sum, s) => sum + s.durationSec, 0);

    // Run FFmpeg with progress tracking
    // Progress range: RENDERING_START (45%) to GENERATING_THUMBNAIL (90%)
    const renderProgressRange = PROGRESS.GENERATING_THUMBNAIL - PROGRESS.RENDERING_START; // 45%
    await runFFmpeg(ffmpegArgs, (timeSec) => {
      const renderPercent = Math.min(timeSec / totalDuration, 1);
      const renderProgress = PROGRESS.RENDERING_START + (renderPercent * renderProgressRange);
      const roundedProgress = Math.round(renderProgress);
      onProgress(roundedProgress);
      // Update DB less frequently to avoid overwhelming it
      if (roundedProgress % 5 === 0) {
        updateJobProgress(jobId, roundedProgress, `Rendering: ${Math.round(renderPercent * 100)}%`);
      }
    });

    // Checkpoint: Generating thumbnail
    console.log("[Render] Checkpoint: Generating thumbnail");
    await updateJobProgress(jobId, PROGRESS.GENERATING_THUMBNAIL, "Generating thumbnail...");
    onProgress(PROGRESS.GENERATING_THUMBNAIL);

    // Generate thumbnail
    const thumbnailPath = path.join(workDir, "thumbnail.jpg");
    await generateThumbnail(outputPath, thumbnailPath);

    // Checkpoint: Uploading video
    console.log("[Render] Checkpoint: Uploading video");
    await updateJobProgress(jobId, PROGRESS.UPLOADING_OUTPUT, "Uploading video...");
    onProgress(PROGRESS.UPLOADING_OUTPUT);

    // Upload output video
    const outputKey = `renders/${projectId}/${uuid()}.mp4`;
    const outputUrl = await uploadFile(outputPath, outputKey, "video/mp4");

    // Checkpoint: Uploading thumbnail
    console.log("[Render] Checkpoint: Uploading thumbnail");
    await updateJobProgress(jobId, PROGRESS.UPLOADING_THUMBNAIL, "Uploading thumbnail...");
    onProgress(PROGRESS.UPLOADING_THUMBNAIL);

    // Upload thumbnail
    const thumbnailKey = `renders/${projectId}/${uuid()}_thumb.jpg`;
    const thumbnailUrl = await uploadFile(thumbnailPath, thumbnailKey, "image/jpeg");

    const sizeBytes = getFileSize(outputPath);

    // Checkpoint: Finalizing
    console.log("[Render] Checkpoint: Finalizing");
    await updateJobProgress(jobId, PROGRESS.FINALIZING, "Finalizing...");
    onProgress(PROGRESS.FINALIZING);

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

    // Checkpoint: Complete
    console.log("[Render] Checkpoint: Complete");
    await updateJobProgress(jobId, PROGRESS.COMPLETE, "Render complete!");
    onProgress(PROGRESS.COMPLETE);
    
    console.log(`[Render] Successfully completed render for project ${projectId}`);
    console.log(`[Render] Output URL: ${outputUrl}`);
    console.log(`[Render] Thumbnail URL: ${thumbnailUrl}`);
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

