import { spawn } from "child_process";
import { config } from "../config";
import { TimelineV1, Scene, TextOverlay } from "../db";

// Supported xfade transitions
const VALID_TRANSITIONS = new Set([
  "fade", "fadeblack", "fadewhite", "wipeleft", "wiperight",
  "wipeup", "wipedown", "slideleft", "slideright", "slideup",
  "slidedown", "circlecrop", "circleopen", "circleclose",
  "dissolve", "pixelize", "radial", "smoothleft", "smoothright",
  "smoothup", "smoothdown",
]);

/**
 * Build FFmpeg command arguments for rendering a timeline with transitions
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
  const inputMap = new Map<string, number>(); // id -> input index
  let inputIndex = 0;

  // Helper to get asset lookup key
  const getAssetKey = (scene: Scene): string | null => {
    // For user assets, use assetId
    if (scene.isUserAsset && scene.assetId) return scene.assetId;
    // For b-roll, use clipId
    if (scene.clipId) return scene.clipId;
    // Fallback to assetId
    return scene.assetId || null;
  };

  // Track which inputs are GIFs (need special handling)
  const gifInputs = new Set<number>();
  
  // Add scene inputs
  for (const scene of scenes) {
    const assetKey = getAssetKey(scene);
    if (assetKey && localAssets.has(assetKey)) {
      if (!inputMap.has(assetKey)) {
        const filePath = localAssets.get(assetKey)!;
        // For GIFs, add ignore_loop to make them animate
        if (filePath.toLowerCase().endsWith('.gif')) {
          args.push("-ignore_loop", "0", "-i", filePath);
          gifInputs.add(inputIndex);
        } else {
          args.push("-i", filePath);
        }
        inputMap.set(assetKey, inputIndex++);
      }
    }
  }

  // Add music input - check both assetId and "music" key
  let musicInputIdx = -1;
  const musicKey = globalSettings.music?.assetId || "music";
  console.log(`[MUSIC DEBUG] Looking for music with key "${musicKey}"`);
  console.log(`[MUSIC DEBUG] Available localAssets keys:`, Array.from(localAssets.keys()));
  console.log(`[MUSIC DEBUG] Music settings:`, JSON.stringify(globalSettings.music));
  
  if (localAssets.has(musicKey)) {
    const musicPath = localAssets.get(musicKey)!;
    console.log(`[MUSIC DEBUG] ✓ Found music file at: ${musicPath}`);
    args.push("-i", musicPath);
    musicInputIdx = inputIndex++;
  } else {
    // Try fallback key "music" if assetId didn't match
    if (musicKey !== "music" && localAssets.has("music")) {
      const musicPath = localAssets.get("music")!;
      console.log(`[MUSIC DEBUG] ✓ Found music with fallback key "music" at: ${musicPath}`);
      args.push("-i", musicPath);
      musicInputIdx = inputIndex++;
    } else {
      console.error(`[MUSIC DEBUG] ✗ Music NOT FOUND in localAssets! Key: "${musicKey}"`);
    }
  }

  // Add voiceover input
  let voiceoverInputIdx = -1;
  if (globalSettings.voiceover.assetId && localAssets.has(globalSettings.voiceover.assetId)) {
    args.push("-i", localAssets.get(globalSettings.voiceover.assetId)!);
    voiceoverInputIdx = inputIndex++;
  }
  
  // Add sound effects inputs
  const sfxInputs: { inputIdx: number; atTimeSec: number; volume: number }[] = [];
  if (timeline.soundEffects && timeline.soundEffects.length > 0) {
    console.log(`Processing ${timeline.soundEffects.length} sound effects`);
    for (const sfx of timeline.soundEffects) {
      if (localAssets.has(sfx.id)) {
        console.log(`Found SFX "${sfx.title}" at: ${localAssets.get(sfx.id)}`);
        args.push("-i", localAssets.get(sfx.id)!);
        sfxInputs.push({
          inputIdx: inputIndex++,
          atTimeSec: sfx.atTimeSec,
          volume: sfx.volume,
        });
      } else {
        console.log(`SFX "${sfx.id}" not found in localAssets`);
      }
    }
  }

  // Add image overlay inputs
  const imageOverlayInputs: { inputIdx: number; atTimeSec: number; durationSec: number; x: number; y: number; scale: number; isGif: boolean }[] = [];
  if (timeline.imageOverlays && timeline.imageOverlays.length > 0) {
    console.log(`Processing ${timeline.imageOverlays.length} image overlays`);
    for (const io of timeline.imageOverlays) {
      if (localAssets.has(io.id)) {
        const filePath = localAssets.get(io.id)!;
        const isGif = filePath.toLowerCase().endsWith('.gif');
        console.log(`Found overlay "${io.title}" at: ${filePath} (isGif: ${isGif})`);
        
        // For GIF overlays, add ignore_loop to make them animate
        if (isGif) {
          args.push("-ignore_loop", "0", "-i", filePath);
        } else {
          args.push("-i", filePath);
        }
        
        imageOverlayInputs.push({
          inputIdx: inputIndex++,
          atTimeSec: io.atTimeSec,
          durationSec: io.durationSec,
          x: io.x,
          y: io.y,
          scale: io.scale,
          isGif,
        });
      } else {
        console.log(`Overlay "${io.id}" not found in localAssets`);
      }
    }
  }

  // Add logo input
  let logoInputIdx = -1;
  if (globalSettings.brand.logoAssetId && localAssets.has(globalSettings.brand.logoAssetId)) {
    args.push("-i", localAssets.get(globalSettings.brand.logoAssetId)!);
    logoInputIdx = inputIndex++;
  }

  // Build filter graph
  const filterParts: string[] = [];
  const processedSceneLabels: string[] = [];

  // Process each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const assetKey = getAssetKey(scene);
    const inputIdx = assetKey ? inputMap.get(assetKey) : null;

    let videoLabel = `scene${i}`;

    if (inputIdx !== null && inputIdx !== undefined) {
      const isGif = gifInputs.has(inputIdx);
      
      // Calculate actual trim duration from in/out points
      const clipTrimDuration = scene.outSec - scene.inSec;
      const requestedDuration = scene.durationSec;
      const needsPadding = requestedDuration > clipTrimDuration + 0.1;
      
      // Trim and scale the input
      if (scene.kind === "video" || isGif) {
        // Videos and GIFs - trim to duration
        if (isGif) {
          // GIFs: trim by duration, loop if needed
          // GIFs use cover mode to fill frame (crop from center)
          // Use max(0, ...) to prevent negative crop coordinates
          filterParts.push(
            `[${inputIdx}:v]trim=duration=${scene.durationSec},setpts=PTS-STARTPTS,` +
              `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
              `crop=${width}:${height}:max(0\\,(iw-${width})/2):max(0\\,(ih-${height})/2),` +
              `fps=${fps},setsar=1[${videoLabel}]`
          );
        } else {
          // Regular video - trim and scale
          const trimmedLabel = `trim${i}`;
          
          // Use "cover" mode for talking head videos (fill frame, crop excess)
          // Use "contain" mode for B-roll (fit within frame, may have letterbox)
          const useCoverMode = scene.isTalkingHead || scene.cropMode === "cover";
          
          if (useCoverMode) {
            // Cover mode: scale to fill, then crop from CENTER to exact size (no black bars)
            // Use max(0, ...) to prevent negative crop coordinates
            // crop syntax: crop=out_w:out_h:x:y
            filterParts.push(
              `[${inputIdx}:v]trim=start=${scene.inSec}:end=${scene.outSec},setpts=PTS-STARTPTS,` +
                `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
                `crop=${width}:${height}:max(0\\,(iw-${width})/2):max(0\\,(ih-${height})/2),` +
                `fps=${fps},setsar=1[${trimmedLabel}]`
            );
          } else {
            // Contain mode: scale to fit, pad with black if needed
            filterParts.push(
              `[${inputIdx}:v]trim=start=${scene.inSec}:end=${scene.outSec},setpts=PTS-STARTPTS,` +
                `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
                `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
                `fps=${fps},setsar=1[${trimmedLabel}]`
            );
          }
          
          // If clip is shorter than requested duration, extend with tpad (freeze last frame)
          if (needsPadding) {
            const paddingNeeded = requestedDuration - clipTrimDuration;
            console.log(`Scene ${i}: clip is ${clipTrimDuration.toFixed(2)}s but need ${requestedDuration.toFixed(2)}s - adding ${paddingNeeded.toFixed(2)}s freeze frame`);
            filterParts.push(
              `[${trimmedLabel}]tpad=stop_mode=clone:stop_duration=${paddingNeeded}[${videoLabel}]`
            );
          } else {
            // Clip is long enough - just rename
            filterParts.push(`[${trimmedLabel}]null[${videoLabel}]`);
          }
        }
      } else {
        // Static image - loop for duration
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
    if (scene.overlays?.text) {
      const overlaidLabel = `scene${i}_text`;
      const textFilters = buildTextOverlay(scene, width, height);
      if (textFilters) {
        filterParts.push(`[${videoLabel}]${textFilters}[${overlaidLabel}]`);
        videoLabel = overlaidLabel;
      }
    }

    processedSceneLabels.push(videoLabel);
  }

  // Build scene concatenation with xfade transitions
  let finalVideoLabel = buildXfadeChain(scenes, processedSceneLabels, filterParts);
  
  // Calculate durations
  const sceneDuration = calculateTotalDuration(scenes);
  
  // Get voiceover duration from timeline - this is the MASTER duration
  let voiceoverDuration = timeline.rendering?.voiceoverDurationSec || 0;
  
  console.log(`=== DURATION DEBUG ===`);
  console.log(`Scene duration (calculated): ${sceneDuration}s`);
  console.log(`Voiceover duration (from timeline): ${voiceoverDuration}s`);
  console.log(`Voiceover input index: ${voiceoverInputIdx}`);
  
  // The AI should have selected clips that match the voiceover duration exactly
  // But if there's still a mismatch, add a small buffer with tpad (frozen last frame)
  // This is a safety net, NOT the expected behavior
  if (voiceoverDuration > 0 && voiceoverDuration > sceneDuration + 0.5) {
    const extraDuration = voiceoverDuration - sceneDuration + 0.5;
    console.warn(`WARNING: Scene duration mismatch! scenes=${sceneDuration}s, voiceover=${voiceoverDuration}s`);
    console.warn(`Adding ${extraDuration}s freeze frame as safety buffer`);
    
    const fillerLabel = "vfiller";
    filterParts.push(
      `[${finalVideoLabel}]tpad=stop_mode=clone:stop_duration=${extraDuration}[${fillerLabel}]`
    );
    finalVideoLabel = fillerLabel;
  } else {
    console.log(`Duration OK: scenes=${sceneDuration}s matches voiceover=${voiceoverDuration}s`);
  }

  // Add global text overlays (from textOverlays array)
  if (timeline.textOverlays && timeline.textOverlays.length > 0) {
    for (let i = 0; i < timeline.textOverlays.length; i++) {
      const overlay = timeline.textOverlays[i];
      const outputLabel = `text${i}`;
      const textFilter = buildGlobalTextOverlay(overlay, width, height);
      if (textFilter) {
        filterParts.push(`[${finalVideoLabel}]${textFilter}[${outputLabel}]`);
        finalVideoLabel = outputLabel;
      }
    }
  }

  // Add logo overlay if present
  if (logoInputIdx >= 0) {
    const logoPos = getLogoPosition(globalSettings.brand.logoPosition, width, height, globalSettings.brand.logoSize);
    filterParts.push(
      `[${logoInputIdx}:v]scale=${globalSettings.brand.logoSize}:-1[logo]`
    );
    filterParts.push(
      `[${finalVideoLabel}][logo]overlay=${logoPos.x}:${logoPos.y}[vlogo]`
    );
    finalVideoLabel = "vlogo";
  }
  
  // Add image overlays (timed overlays like subscribe buttons, arrows)
  for (let i = 0; i < imageOverlayInputs.length; i++) {
    const io = imageOverlayInputs[i];
    const endTime = io.atTimeSec + io.durationSec;
    const outputLabel = `imgov${i}`;
    
    // Scale overlay - for GIFs, trim to duration to prevent infinite stream
    const scaleLabel = `imgscale${i}`;
    if (io.isGif) {
      // GIF: CRITICAL - trim to exact duration to prevent infinite stream from hanging FFmpeg
      // The -ignore_loop 0 on input makes it loop, but we must trim to prevent hanging
      filterParts.push(
        `[${io.inputIdx}:v]trim=duration=${io.durationSec},fps=${fps},scale=iw*${io.scale}:ih*${io.scale},setpts=PTS-STARTPTS[${scaleLabel}]`
      );
    } else {
      // Static image: just scale
      filterParts.push(
        `[${io.inputIdx}:v]scale=iw*${io.scale}:ih*${io.scale}[${scaleLabel}]`
      );
    }
    
    // Position is percentage-based: x,y are 0-100
    const xPos = `(W*${io.x / 100})-(w/2)`;
    const yPos = `(H*${io.y / 100})-(h/2)`;
    
    // Overlay with enable filter for timing
    // CRITICAL: Use eof_action=pass to NOT freeze video when overlay ends
    // The 'enable' filter handles when to show/hide, eof_action handles stream end
    filterParts.push(
      `[${finalVideoLabel}][${scaleLabel}]overlay=${xPos}:${yPos}:enable='between(t,${io.atTimeSec},${endTime})':eof_action=pass:shortest=0[${outputLabel}]`
    );
    finalVideoLabel = outputLabel;
  }

  // Burn in captions if enabled
  if (globalSettings.captions?.enabled && globalSettings.captions?.burnIn && globalSettings.captions?.segments?.length) {
    let captionSegments = globalSettings.captions.segments;
    const captionFont = globalSettings.captions.font || "Inter";
    
    // Filter out invalid segments (start >= end or duration < 0.1s)
    captionSegments = captionSegments.filter((seg, i) => {
      const duration = seg.end - seg.start;
      if (duration < 0.1) {
        console.warn(`Skipping caption ${i} - too short: "${seg.text}" (${duration}s)`);
        return false;
      }
      if (seg.start < 0) {
        console.warn(`Skipping caption ${i} - negative start time: "${seg.text}"`);
        return false;
      }
      return true;
    });
    
    console.log(`Burning in ${captionSegments.length} caption segments with font: ${captionFont}`);
    
    // Log first few captions for debugging
    console.log("Caption timing (first 5):");
    captionSegments.slice(0, 5).forEach((seg, i) => {
      console.log(`  [${i}] ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s: "${seg.text.slice(0, 30)}..."`);
    });
    
    // Build a chain of drawtext filters for each caption
    for (let i = 0; i < captionSegments.length; i++) {
      const segment = captionSegments[i];
      const outputLabel = `cap${i}`;
      
      // Calculate font size based on video height (approximately 5% of height)
      const fontSize = Math.round(height * 0.045);
      
      // Escape text for FFmpeg - be thorough
      const escapedText = segment.text
        .replace(/\\/g, "\\\\\\\\") // Escape backslashes
        .replace(/'/g, "'\\''")     // Escape single quotes
        .replace(/:/g, "\\:")       // Escape colons
        .replace(/\[/g, "\\[")      // Escape brackets
        .replace(/\]/g, "\\]")
        .replace(/"/g, '\\"')       // Escape double quotes
        .replace(/%/g, "\\%")       // Escape percent signs
        .replace(/;/g, "\\;");      // Escape semicolons
      
      // Position at bottom center with black background
      const filter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:x=(w-text_w)/2:y=h-text_h-${Math.round(height * 0.08)}:box=1:boxcolor=black@0.7:boxborderw=10:enable='between(t,${segment.start.toFixed(3)},${segment.end.toFixed(3)})'`;
      
      filterParts.push(`[${finalVideoLabel}]${filter}[${outputLabel}]`);
      finalVideoLabel = outputLabel;
    }
  } else {
    console.log("Captions not enabled or no segments to burn in");
  }

  // Audio mixing
  // Calculate total duration including intro offset
  const introOffset = globalSettings.voiceover.startOffset || 0;
  const totalDuration = Math.max(sceneDuration, voiceoverDuration + introOffset);
  console.log(`Duration - scenes: ${sceneDuration}s, voiceover: ${voiceoverDuration}s, introOffset: ${introOffset}s, using: ${totalDuration}s`);
  
  let finalAudioLabel = "";
  const audioLabels: string[] = [];
  let audioIndex = 0;

  // Process music - apply volume more aggressively for faint levels
  if (musicInputIdx >= 0) {
    // Volume levels: faint=0.1, low=0.2, medium=0.3, loud=0.5
    // For very low volumes, apply twice for better effect
    const musicVol = globalSettings.music?.volume ?? 0.3;
    const musicLabel = `music${audioIndex++}`;
    console.log(`[MUSIC DEBUG] ✓ Adding music to audio mix - input index: ${musicInputIdx}, volume: ${musicVol}, duration: ${totalDuration}s`);
    filterParts.push(
      `[${musicInputIdx}:a]aloop=loop=-1:size=2e+09,atrim=duration=${totalDuration},volume=${musicVol}[${musicLabel}]`
    );
    audioLabels.push(musicLabel);
    console.log(`[MUSIC DEBUG] ✓ Music added with label: ${musicLabel}`);
  } else {
    console.error(`[MUSIC DEBUG] ✗ Music input index is -1, music will NOT be in final video!`);
  }
  
  // Check if this is a talking head video (audio comes from user's video scenes)
  const isTalkingHead = timeline.rendering?.isTalkingHead || false;
  
  if (isTalkingHead) {
    // For talking head: use audioTracks to get CONTINUOUS audio from original user videos
    // The audio should play continuously even during B-roll (visual only switches)
    console.log("Processing talking head audio...");
    
    const audioTracks = timeline.audioTracks || [];
    
    if (audioTracks.length > 0) {
      // Use audioTracks for continuous audio extraction
      const audioTrackLabels: string[] = [];
      
      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        const inputIdx = inputMap.get(track.assetId);
        
        if (inputIdx !== null && inputIdx !== undefined) {
          const trackLabel = `thtrack${i}`;
          const volume = track.volume || 1.0;
          const startOffset = track.startOffset || 0;
          
          if (startOffset > 0) {
            // Delay audio to start at the correct offset
            const delayMs = Math.round(startOffset * 1000);
            filterParts.push(
              `[${inputIdx}:a]volume=${volume},adelay=${delayMs}|${delayMs}[${trackLabel}]`
            );
          } else {
            // No delay needed for first track
            filterParts.push(
              `[${inputIdx}:a]volume=${volume}[${trackLabel}]`
            );
          }
          audioTrackLabels.push(trackLabel);
          console.log(`Added audio track ${i} from asset ${track.assetId} at offset ${startOffset}s`);
        }
      }
      
      if (audioTrackLabels.length > 0) {
        const thAudioLabel = `thvoice${audioIndex++}`;
        if (audioTrackLabels.length === 1) {
          // Single track - just copy it
          filterParts.push(`[${audioTrackLabels[0]}]acopy[${thAudioLabel}]`);
        } else {
          // Multiple tracks - mix them together (they're sequential, so concat)
          // Use amix since tracks may overlap slightly at edges
          filterParts.push(
            `${audioTrackLabels.map(l => `[${l}]`).join("")}amix=inputs=${audioTrackLabels.length}:duration=longest:normalize=0[${thAudioLabel}]`
          );
        }
        audioLabels.push(thAudioLabel);
        console.log(`Created talking head audio from ${audioTrackLabels.length} continuous tracks`);
      }
    } else {
      // Fallback: extract audio from talking head scenes (old behavior)
      console.log("No audioTracks found, falling back to scene-based audio extraction");
      const talkingHeadAudioParts: string[] = [];
      
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        
        if (scene.isTalkingHead) {
          const assetKey = scene.assetId || scene.clipId;
          const inputIdx = assetKey ? inputMap.get(assetKey) : null;
          
          if (inputIdx !== null && inputIdx !== undefined) {
            const audioLabel = `thaud${i}`;
            filterParts.push(
              `[${inputIdx}:a]atrim=start=${scene.inSec}:end=${scene.outSec},asetpts=PTS-STARTPTS[${audioLabel}]`
            );
            talkingHeadAudioParts.push(`[${audioLabel}]`);
          }
        }
      }
      
      if (talkingHeadAudioParts.length > 0) {
        const thAudioLabel = `thvoice${audioIndex++}`;
        if (talkingHeadAudioParts.length === 1) {
          filterParts.push(`${talkingHeadAudioParts[0]}acopy[${thAudioLabel}]`);
        } else {
          filterParts.push(
            `${talkingHeadAudioParts.join("")}concat=n=${talkingHeadAudioParts.length}:v=0:a=1[${thAudioLabel}]`
          );
        }
        audioLabels.push(thAudioLabel);
        console.log(`Created talking head audio from ${talkingHeadAudioParts.length} segments`);
      }
    }
  } else {
    // Process voiceover - delay if there's an intro
    // The voiceover is the MASTER duration - video should match it, not the other way around
    if (voiceoverInputIdx >= 0) {
      const voVol = globalSettings.voiceover.volume;
      const voLabel = `vo${audioIndex++}`;
      const voStartOffset = globalSettings.voiceover.startOffset || 0;
      
      if (voStartOffset > 0) {
        // Delay voiceover to start after intro
        const delayMs = Math.round(voStartOffset * 1000);
        console.log(`Voiceover delayed by ${voStartOffset}s (${delayMs}ms) for intro`);
        filterParts.push(
          `[${voiceoverInputIdx}:a]volume=${voVol},adelay=${delayMs}|${delayMs}[${voLabel}]`
        );
      } else {
        // No delay needed
        filterParts.push(
          `[${voiceoverInputIdx}:a]volume=${voVol}[${voLabel}]`
        );
      }
      audioLabels.push(voLabel);
    }
  }
  
  // Process sound effects (delayed to specific times)
  for (const sfx of sfxInputs) {
    const sfxLabel = `sfx${audioIndex++}`;
    // adelay takes milliseconds
    const delayMs = Math.round(sfx.atTimeSec * 1000);
    filterParts.push(
      `[${sfx.inputIdx}:a]volume=${sfx.volume},adelay=${delayMs}|${delayMs}[${sfxLabel}]`
    );
    audioLabels.push(sfxLabel);
  }
  
  // Mix all audio sources
  console.log(`Audio sources: music=${musicInputIdx >= 0}, voiceover=${voiceoverInputIdx >= 0}, sfx=${sfxInputs.length}`);
  if (audioLabels.length > 0) {
    console.log(`Mixing ${audioLabels.length} audio sources: ${audioLabels.join(", ")}`);
    if (audioLabels.length === 1) {
      // Just one audio source - rename it
      filterParts.push(`[${audioLabels[0]}]acopy[aout]`);
    } else {
      // Multiple sources - mix them with weights to preserve volume levels
      // Use 'first' duration to match voiceover length (voiceover should be first if present)
      const labelString = audioLabels.map(l => `[${l}]`).join("");
      // weights=1 for each input preserves original volumes; normalize=0 prevents auto-normalization
      const weights = audioLabels.map(() => "1").join(" ");
      filterParts.push(
        `${labelString}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=2:weights="${weights}":normalize=0[aout]`
      );
    }
    finalAudioLabel = "aout";
  } else {
    console.log("No audio sources to mix");
  }

  // Combine filter graph
  args.push("-filter_complex", filterParts.join(";"));

  // Map outputs
  console.log(`Mapping video: [${finalVideoLabel}]`);
  args.push("-map", `[${finalVideoLabel}]`);
  if (finalAudioLabel) {
    console.log(`Mapping audio: [${finalAudioLabel}]`);
    args.push("-map", `[${finalAudioLabel}]`);
  } else {
    console.log("WARNING: No audio label to map!");
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
  if (finalAudioLabel) {
    args.push("-c:a", "aac");
    args.push("-b:a", `${globalSettings.export.audioKbps}k`);
  }
  
  // Suppress subtitle and data streams that might cause visual artifacts
  args.push("-sn"); // No subtitles
  args.push("-dn"); // No data streams
  
  args.push("-movflags", "+faststart");
  args.push("-pix_fmt", "yuv420p");
  
  // Limit output duration - include intro offset to not cut off the end
  // totalDuration already accounts for intro offset
  args.push("-t", String(totalDuration + 0.5));

  args.push(outputPath);

  return args;
}

/**
 * Build xfade chain between scenes
 * Returns the final video label
 */
function buildXfadeChain(
  scenes: Scene[],
  sceneLabels: string[],
  filterParts: string[]
): string {
  if (sceneLabels.length === 0) return "vconcat";
  if (sceneLabels.length === 1) {
    filterParts.push(`[${sceneLabels[0]}]copy[vconcat]`);
    return "vconcat";
  }

  // Check if any transitions are defined
  const hasTransitions = scenes.some(
    (s, i) => i < scenes.length - 1 && s.transitionOut && s.transitionOut !== "none"
  );

  if (!hasTransitions) {
    // Simple concat without transitions
    const labels = sceneLabels.map(l => `[${l}]`).join("");
    filterParts.push(`${labels}concat=n=${sceneLabels.length}:v=1:a=0[vconcat]`);
    return "vconcat";
  }

  // Build xfade chain
  let currentLabel = sceneLabels[0];
  let offset = scenes[0].durationSec;

  for (let i = 1; i < scenes.length; i++) {
    const prevScene = scenes[i - 1];
    const currentScene = scenes[i];
    const nextLabel = sceneLabels[i];
    const outputLabel = i === scenes.length - 1 ? "vconcat" : `xf${i}`;

    // Get transition settings
    const transition = prevScene.transitionOut || "fade";
    const transitionDuration = (prevScene as any).transitionDuration || 0.5;

    if (transition && transition !== "none" && VALID_TRANSITIONS.has(transition)) {
      // Calculate offset (when to start the transition)
      const xfadeOffset = Math.max(0, offset - transitionDuration);
      
      filterParts.push(
        `[${currentLabel}][${nextLabel}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${xfadeOffset}[${outputLabel}]`
      );
      
      // Update offset for next transition (account for overlap)
      offset = xfadeOffset + currentScene.durationSec;
    } else {
      // No transition - simple concat of these two
      filterParts.push(
        `[${currentLabel}][${nextLabel}]concat=n=2:v=1:a=0[${outputLabel}]`
      );
      offset += currentScene.durationSec;
    }

    currentLabel = outputLabel;
  }

  return "vconcat";
}

/**
 * Calculate total duration accounting for transitions
 */
function calculateTotalDuration(scenes: Scene[]): number {
  let total = 0;
  
  for (let i = 0; i < scenes.length; i++) {
    total += scenes[i].durationSec;
    
    // Subtract transition overlap (except for last scene)
    if (i < scenes.length - 1) {
      const scene = scenes[i];
      if (scene.transitionOut && scene.transitionOut !== "none") {
        const transitionDuration = (scene as any).transitionDuration || 0.5;
        total -= transitionDuration;
      }
    }
  }
  
  return Math.max(0, total);
}

/**
 * Build text overlay filter for a scene
 */
function buildTextOverlay(scene: Scene, width: number, height: number): string {
  const overlays = scene.overlays!;
  
  if (!overlays.text) return "";
  
  // Get position from XY coordinates (percentage-based)
  const xPos = overlays.x !== undefined 
    ? `(w*${overlays.x / 100})-(text_w/2)` 
    : "(w-text_w)/2";
  const yPos = overlays.y !== undefined 
    ? `(h*${overlays.y / 100})-(text_h/2)` 
    : `h-text_h-${Math.round(height * 0.15)}`;

  // Style settings
  const style = overlays.style || { color: "#FFFFFF", fontSize: 5, fontFamily: "Arial", duration: 0 };
  
  // Convert hex color to FFmpeg format (remove # and add 0x)
  const fontColor = style.color.startsWith("#") 
    ? style.color.replace("#", "0x") 
    : style.color;
  
  // Calculate font size based on video height (fontSize is 1-10 scale)
  const fontSize = Math.round((style.fontSize / 10) * (height / 10));
  
  const escapedText = escapeFFmpegText(overlays.text);
  let filter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}`;
  filter += `:x=${xPos}:y=${yPos}`;
  filter += `:shadowcolor=black@0.7:shadowx=2:shadowy=2`;
  
  // Add duration control if specified
  if (style.duration > 0) {
    filter += `:enable='lte(t,${style.duration})'`;
  }

  return filter;
}

/**
 * Build text overlay filter for global text overlays (from textOverlays array)
 */
function buildGlobalTextOverlay(overlay: TextOverlay, width: number, height: number): string {
  if (!overlay.text) return "";
  
  // Get position from XY coordinates (percentage-based)
  const xPos = `(w*${overlay.x / 100})-(text_w/2)`;
  const yPos = `(h*${overlay.y / 100})-(text_h/2)`;

  const style = overlay.style;
  
  // Convert hex color to FFmpeg format
  const fontColor = style.color.startsWith("#") 
    ? style.color.replace("#", "0x") 
    : style.color;
  
  // Calculate font size based on video height (fontSize is 1-10 scale)
  const fontSize = Math.round((style.fontSize / 10) * (height / 10));
  
  const escapedText = escapeFFmpegText(overlay.text);
  let filter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}`;
  filter += `:x=${xPos}:y=${yPos}`;
  filter += `:shadowcolor=black@0.7:shadowx=2:shadowy=2`;
  
  // Enable based on start time and duration
  if (overlay.duration > 0) {
    const endTime = overlay.startTime + overlay.duration;
    filter += `:enable='between(t,${overlay.startTime},${endTime})'`;
  } else if (overlay.startTime > 0) {
    filter += `:enable='gte(t,${overlay.startTime})'`;
  }

  return filter;
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
    console.log("Running FFmpeg with args:", args.slice(0, 30).join(" "), "...");

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
        const lastStderr = stderr.slice(-1500);
        console.error("FFmpeg stderr:", lastStderr);
        reject(new Error(`FFmpeg exited with code ${code}: ${lastStderr}`));
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
