import { spawn } from "child_process";
import { config } from "../config";
import { TimelineV1, Scene } from "../db";

/**
 * Build FFmpeg command arguments for rendering a timeline
 */
export function buildFFmpegCommand(
  timeline: TimelineV1,
  localAssets: Map<string, string>,
  outputPath: string
): string[] {
  const { project, scenes, global: globalSettings } = timeline;
  const { width, height } = project.resolution;
  const fps = project.fps;

  const args: string[] = ["-y"]; // Overwrite output

  // Input files
  const inputMap = new Map<string, number>(); // assetId -> input index
  let inputIndex = 0;

  // Add scene inputs
  for (const scene of scenes) {
    if (scene.assetId && localAssets.has(scene.assetId)) {
      if (!inputMap.has(scene.assetId)) {
        args.push("-i", localAssets.get(scene.assetId)!);
        inputMap.set(scene.assetId, inputIndex++);
      }
    }
  }

  // Add music input
  let musicInputIdx = -1;
  if (globalSettings.music.assetId && localAssets.has(globalSettings.music.assetId)) {
    args.push("-i", localAssets.get(globalSettings.music.assetId)!);
    musicInputIdx = inputIndex++;
  }

  // Add voiceover input
  let voiceoverInputIdx = -1;
  if (globalSettings.voiceover.assetId && localAssets.has(globalSettings.voiceover.assetId)) {
    args.push("-i", localAssets.get(globalSettings.voiceover.assetId)!);
    voiceoverInputIdx = inputIndex++;
  }

  // Add logo input
  let logoInputIdx = -1;
  if (globalSettings.brand.logoAssetId && localAssets.has(globalSettings.brand.logoAssetId)) {
    args.push("-i", localAssets.get(globalSettings.brand.logoAssetId)!);
    logoInputIdx = inputIndex++;
  }

  // Build filter graph
  const filterParts: string[] = [];
  const sceneLabels: string[] = [];

  // Process each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const inputIdx = scene.assetId ? inputMap.get(scene.assetId) : null;

    let videoLabel = `scene${i}`;

    if (inputIdx !== null && inputIdx !== undefined) {
      // Trim and scale the input
      if (scene.kind === "video") {
        filterParts.push(
          `[${inputIdx}:v]trim=start=${scene.inSec}:end=${scene.outSec},setpts=PTS-STARTPTS,` +
            `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
            `fps=${fps},setsar=1[${videoLabel}]`
        );
      } else {
        // Image - loop for duration
        filterParts.push(
          `[${inputIdx}:v]loop=loop=${Math.ceil(scene.durationSec * fps)}:size=1:start=0,` +
            `setpts=PTS-STARTPTS,` +
            `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
            `fps=${fps},setsar=1,trim=duration=${scene.durationSec}[${videoLabel}]`
        );
      }
    } else {
      // No asset - create black placeholder
      filterParts.push(
        `color=c=black:s=${width}x${height}:r=${fps}:d=${scene.durationSec}[${videoLabel}]`
      );
    }

    // Add text overlays
    if (scene.overlays?.title || scene.overlays?.subtitle) {
      const overlaidLabel = `scene${i}_text`;
      const textFilters = buildTextOverlay(scene, width, height);
      filterParts.push(`[${videoLabel}]${textFilters}[${overlaidLabel}]`);
      videoLabel = overlaidLabel;
    }

    sceneLabels.push(`[${videoLabel}]`);
  }

  // Concatenate all scenes
  if (sceneLabels.length > 1) {
    filterParts.push(`${sceneLabels.join("")}concat=n=${sceneLabels.length}:v=1:a=0[vconcat]`);
  } else {
    filterParts.push(`${sceneLabels[0]}copy[vconcat]`);
  }

  // Add logo overlay if present
  let finalVideoLabel = "vconcat";
  if (logoInputIdx >= 0) {
    const logoPos = getLogoPosition(globalSettings.brand.logoPosition, width, height, globalSettings.brand.logoSize);
    filterParts.push(
      `[${logoInputIdx}:v]scale=${globalSettings.brand.logoSize}:-1[logo]`
    );
    filterParts.push(
      `[vconcat][logo]overlay=${logoPos.x}:${logoPos.y}[vlogo]`
    );
    finalVideoLabel = "vlogo";
  }

  // Audio mixing
  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSec, 0);
  let audioFilters: string[] = [];
  let audioLabel = "";

  if (musicInputIdx >= 0 || voiceoverInputIdx >= 0) {
    if (musicInputIdx >= 0 && voiceoverInputIdx >= 0) {
      // Mix both with ducking (music under voiceover)
      const musicVol = globalSettings.music.volume;
      const voVol = globalSettings.voiceover.volume;
      audioFilters.push(
        `[${musicInputIdx}:a]aloop=loop=-1:size=2e+09,atrim=duration=${totalDuration},volume=${musicVol}[music]`
      );
      audioFilters.push(
        `[${voiceoverInputIdx}:a]volume=${voVol}[vo]`
      );
      // Simple mix (for MVP - proper ducking would use sidechaincompress)
      audioFilters.push(
        `[music][vo]amix=inputs=2:duration=longest:dropout_transition=2[aout]`
      );
      audioLabel = "aout";
    } else if (musicInputIdx >= 0) {
      const musicVol = globalSettings.music.volume;
      audioFilters.push(
        `[${musicInputIdx}:a]aloop=loop=-1:size=2e+09,atrim=duration=${totalDuration},volume=${musicVol}[aout]`
      );
      audioLabel = "aout";
    } else if (voiceoverInputIdx >= 0) {
      const voVol = globalSettings.voiceover.volume;
      audioFilters.push(
        `[${voiceoverInputIdx}:a]volume=${voVol}[aout]`
      );
      audioLabel = "aout";
    }
    filterParts.push(...audioFilters);
  }

  // Combine filter graph
  args.push("-filter_complex", filterParts.join(";"));

  // Map outputs
  args.push("-map", `[${finalVideoLabel}]`);
  if (audioLabel) {
    args.push("-map", `[${audioLabel}]`);
  } else {
    // Add silent audio
    args.push("-f", "lavfi", "-t", String(totalDuration), "-i", "anullsrc=r=48000:cl=stereo");
    args.push("-shortest");
  }

  // Output settings
  const codec = globalSettings.export.codec === "h265" ? "libx265" : "libx264";
  args.push("-c:v", codec);

  if (globalSettings.export.crf !== undefined) {
    args.push("-crf", String(globalSettings.export.crf));
  } else {
    args.push("-b:v", `${globalSettings.export.bitrateMbps}M`);
  }

  args.push("-preset", "medium");
  args.push("-c:a", "aac");
  args.push("-b:a", `${globalSettings.export.audioKbps}k`);
  args.push("-movflags", "+faststart");
  args.push("-pix_fmt", "yuv420p");

  args.push(outputPath);

  return args;
}

/**
 * Build text overlay filter for a scene
 */
function buildTextOverlay(scene: Scene, width: number, height: number): string {
  const overlays = scene.overlays!;
  const filters: string[] = [];

  // Get position coordinates
  const pos = getTextPosition(overlays.position || "lower_third", width, height);

  // Style settings
  const style = overlays.stylePreset || "lower_third";
  const fontColor = "white";
  const fontSize = Math.round(height / 20);
  const subtitleSize = Math.round(height / 28);

  // Box settings
  const boxEnabled = style === "boxed" || style === "lower_third";
  const boxColor = style === "boxed" ? "black@0.7" : "0x00b4d8@0.8";

  if (overlays.title) {
    const escapedTitle = escapeFFmpegText(overlays.title);
    let filter = `drawtext=text='${escapedTitle}':fontsize=${fontSize}:fontcolor=${fontColor}`;
    filter += `:x=${pos.x}:y=${pos.y}`;
    if (boxEnabled) {
      filter += `:box=1:boxcolor=${boxColor}:boxborderw=10`;
    }
    filter += `:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
    filters.push(filter);
  }

  if (overlays.subtitle) {
    const escapedSubtitle = escapeFFmpegText(overlays.subtitle);
    let filter = `drawtext=text='${escapedSubtitle}':fontsize=${subtitleSize}:fontcolor=${fontColor}@0.9`;
    const subtitleY = overlays.title ? `${pos.y}+${fontSize}+20` : pos.y;
    filter += `:x=${pos.x}:y=${subtitleY}`;
    if (boxEnabled) {
      filter += `:box=1:boxcolor=${boxColor}:boxborderw=8`;
    }
    filter += `:shadowcolor=black@0.5:shadowx=1:shadowy=1`;
    filters.push(filter);
  }

  return filters.join(",");
}

/**
 * Get text position based on position name
 */
function getTextPosition(
  position: string,
  width: number,
  height: number
): { x: string; y: string } {
  switch (position) {
    case "center":
      return { x: "(w-text_w)/2", y: "(h-text_h)/2" };
    case "top":
      return { x: "(w-text_w)/2", y: String(Math.round(height * 0.1)) };
    case "bottom":
      return { x: "(w-text_w)/2", y: `h-text_h-${Math.round(height * 0.1)}` };
    case "lower_third":
      return { x: "(w-text_w)/2", y: `h-text_h-${Math.round(height * 0.15)}` };
    case "upper_third":
      return { x: "(w-text_w)/2", y: String(Math.round(height * 0.15)) };
    default:
      return { x: "(w-text_w)/2", y: `h-text_h-${Math.round(height * 0.15)}` };
  }
}

/**
 * Get logo position based on position name
 */
function getLogoPosition(
  position: string,
  width: number,
  height: number,
  logoSize: number
): { x: string; y: string } {
  const margin = 30;
  switch (position) {
    case "top-left":
      return { x: String(margin), y: String(margin) };
    case "top-right":
      return { x: `W-w-${margin}`, y: String(margin) };
    case "bottom-left":
      return { x: String(margin), y: `H-h-${margin}` };
    case "bottom-right":
      return { x: `W-w-${margin}`, y: `H-h-${margin}` };
    default:
      return { x: `W-w-${margin}`, y: String(margin) };
  }
}

/**
 * Escape text for FFmpeg drawtext filter
 */
function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/**
 * Run FFmpeg with progress tracking
 */
export function runFFmpeg(
  args: string[],
  onProgress: (timeSec: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Running FFmpeg with args:", args.slice(0, 20).join(" "), "...");

    const ffmpeg = spawn(config.ffmpegPath, args);

    let stderr = "";

    ffmpeg.stderr.on("data", (data: Buffer) => {
      const line = data.toString();
      stderr += line;

      // Parse progress from FFmpeg output
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseFloat(timeMatch[3]);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        onProgress(totalSeconds);
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error("FFmpeg stderr:", stderr.slice(-2000));
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

/**
 * Generate thumbnail from video
 */
export function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timeSec: number = 1
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-ss", String(timeSec),
      "-i", videoPath,
      "-vframes", "1",
      "-q:v", "2",
      outputPath,
    ];

    const ffmpeg = spawn(config.ffmpegPath, args);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Thumbnail generation failed with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
}

