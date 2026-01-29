import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { v4 as uuid } from "uuid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Available FFmpeg xfade transitions
const TRANSITIONS = [
  "fade", "fadeblack", "fadewhite", "wipeleft", "wiperight",
  "wipeup", "wipedown", "slideleft", "slideright", "slideup",
  "slidedown", "circlecrop", "circleopen", "circleclose",
  "dissolve", "pixelize", "radial", "smoothleft", "smoothright",
] as const;

// ============================================================================
// AGENT 1: CLIP SELECTOR - Only sees video clips, returns scenes
// ============================================================================
const CLIP_AGENT_PROMPT = `You are a VIDEO CLIP SELECTOR. Your job is to select DIFFERENT video clips to create an engaging video.

CRITICAL RULES:
1. NEVER use the same clipId twice - EACH SCENE MUST USE A DIFFERENT CLIP
2. SUM of all durationSec MUST EQUAL the target duration EXACTLY
3. Each clip's durationSec cannot exceed its actual duration from the clip list
4. Select 4-8 different clips for variety (more clips = more visual interest)
5. Scene durations: 3-8 seconds typical, adjust last scene to hit exact target

SCENE CHANGES (IMPORTANT):
- Some clips include "Scene cuts at: [timestamps]" - these are detected camera/scene changes
- Use scene changes to pick CLEAN CUT POINTS - start/end clips at scene change timestamps
- Example: If clip has "Scene cuts at: [3.5s, 7.2s]", consider:
  - Using 0-3.5s (before first scene change)
  - Using 3.5-7.2s (between scene changes)
  - Using 7.2s-end (after last scene change)
- This prevents awkward mid-scene cuts and creates smoother transitions
- If no scene changes listed, the clip is likely a single continuous shot

STEP-BY-STEP PROCESS:
1. Note the EXACT target duration
2. Browse ALL available clips and select DIFFERENT ones that match the script
3. Consider scene change timestamps for clean cut points
4. Assign durations (3-8 seconds each)
5. VERIFY: Each clipId appears ONLY ONCE
6. VERIFY: Sum of durations = target duration exactly

EXAMPLE - Target 20 seconds with 4 DIFFERENT clips:
- Scene 1: clipId "abc..." → 5s (clip about topic A)
- Scene 2: clipId "def..." → 5s (clip about topic B)  
- Scene 3: clipId "ghi..." → 5s (clip about topic C)
- Scene 4: clipId "jkl..." → 5s (clip about topic D)
- Total: 5+5+5+5 = 20 ✓
- All clipIds are UNIQUE ✓

AVAILABLE TRANSITIONS: fade, fadeblack, fadewhite, dissolve, wipeleft, wiperight, slideup, slidedown

RESPOND WITH ONLY THIS JSON:
{
  "totalDuration": [TARGET_DURATION],
  "scenes": [
    {
      "clipId": "uuid-from-clips-list",
      "intent": "Brief description of what this clip shows",
      "durationSec": [NUMBER],
      "inSec": 0,
      "outSec": [NUMBER],
      "transitionOut": "fade",
      "transitionDuration": 0.5,
      "isUserAsset": false
    }
  ]
}`;

// ============================================================================
// AGENT 2: AUDIO SELECTOR - Only sees music and SFX, returns audio decisions
// ============================================================================
const AUDIO_AGENT_PROMPT = `You are an AUDIO SELECTOR. Your job is to select background music and place sound effects for a video.

You will receive:
- A voiceover script
- The video duration
- A list of MUSIC TRACKS (with ID, title, artist, mood)
- A list of SOUND EFFECTS (with ID, title, description)

RULES:
1. Select ONE music track that best fits the video mood/content from the available list
2. Add 1-3 sound effects at impactful moments (not too many!)
3. Sound effects should enhance key moments, transitions, or emphasis
4. Consider the script content when placing effects
5. Music volume should be 0.2-0.4 (background level so voiceover is clear)

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "music": {
    "trackId": "uuid-from-music-list",
    "title": "Track name",
    "volume": 0.3
  },
  "soundEffects": [
    {
      "effectId": "uuid-from-sfx-list",
      "title": "Effect name",
      "atTimeSec": 5.0,
      "volume": 0.5
    }
  ]
}

If no music tracks are available, set music to null.
If no sound effects needed, set soundEffects to empty array [].`;

// ============================================================================
// AGENT 3: OVERLAY SELECTOR - Only sees overlays/graphics, returns placements
// ============================================================================
const OVERLAY_AGENT_PROMPT = `You are an OVERLAY SELECTOR. Your ONLY job is to place image/GIF overlays on top of the video.

You will receive:
- A voiceover script
- The video duration
- A list of OVERLAYS (images, GIFs, graphics like subscribe buttons, arrows, etc)

RULES:
1. Add 0-3 overlays total (don't overdo it!)
2. Overlays appear ON TOP of the video, not as the video itself
3. Place overlays at relevant moments (e.g., subscribe button near the end)
4. x,y are percentages (0-100) from top-left corner where the CENTER of the overlay will be placed
   - x=50, y=50 = center of screen
   - x=80, y=20 = top-right area
   - x=20, y=80 = bottom-left area
5. SCALE IS IMPORTANT - make overlays visible and impactful:
   - scale=0.5 = 50% size (small, subtle)
   - scale=1.0 = 100% original size (normal)
   - scale=1.5 = 150% size (larger, more visible)
   - scale=2.0 = 200% size (big and prominent)
   - scale=2.5-3.0 = very large (for full-screen or near full-screen effects)
   - For GIFs and animated graphics, use scale 1.5-2.5 to make them clearly visible
   - For subscribe buttons and CTAs, use scale 1.5-2.0

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "imageOverlays": [
    {
      "overlayId": "uuid-from-overlays-list",
      "title": "Overlay name",
      "atTimeSec": 10.0,
      "durationSec": 3.0,
      "x": 50,
      "y": 50,
      "scale": 1.5
    }
  ]
}

If no overlays needed, set imageOverlays to empty array [].`;

// ============================================================================
// AGENT 4: TEXT EFFECT SELECTOR - Adds text effects from effects library
// ============================================================================
const TEXT_EFFECT_AGENT_PROMPT = `You are a TEXT EFFECT SELECTOR. Your job is to add text effects that enhance the video.

Available effects:
1. "lower-third-minimal" - For introducing speakers/topics. Fields: header (25 chars max), body (40 chars max)
2. "slide-box-left" - For key points, agenda items. Fields: header (20 chars max), body (40 chars max)
3. "slide-box-right" - For key points, callouts. Fields: header (20 chars max), body (40 chars max)
4. "letterbox-with-text" - Cinematic bars with text. Fields: topText (50 chars), bottomText (50 chars)
5. "corner-accents" - Decorative frame. No text fields.
6. "border-glow" - Glowing border effect. No text fields.

TIMING:
- Effects display for 0.4 seconds per word (minimum 2 seconds total)
- Example: 5 words = 2 seconds (fast but readable)

RULES:
1. Add 0-3 text effects total (don't overdo it!)
2. Use lower-thirds when introducing topics or speakers
3. Use slide-boxes for key points or chapter markers
4. Use letterbox for cinematic moments or location text
5. Don't place effects during important visual moments
6. Space effects apart - don't stack them

RESPOND WITH ONLY THIS JSON FORMAT:
{
  "textEffects": [
    {
      "effectId": "lower-third-minimal",
      "atTimeSec": 5.0,
      "header": "John Smith",
      "body": "CEO & Founder"
    },
    {
      "effectId": "slide-box-left",
      "atTimeSec": 15.0,
      "header": "KEY POINT",
      "body": "Our main message here"
    }
  ]
}

If no effects needed, set textEffects to empty array [].`;

// ============================================================================
// Helper: Normalize scene durations to match target exactly
// IMPORTANT: Must account for transition overlap - xfade removes transition duration from total
// ============================================================================
function normalizeSceneDurations(scenes: any[], targetDuration: number): any[] {
  if (!scenes || scenes.length === 0) return scenes;
  
  // Make a copy to avoid mutation
  const adjustedScenes = scenes.map(s => ({ ...s }));
  
  // Calculate transition overlap - each transition removes its duration from total video length
  let transitionOverlap = 0;
  for (let i = 0; i < adjustedScenes.length - 1; i++) {
    const scene = adjustedScenes[i];
    if (scene.transitionOut && scene.transitionOut !== "none") {
      const transitionDuration = scene.transitionDuration || 0.5;
      transitionOverlap += transitionDuration;
    }
  }
  
  // The actual target for scene durations must be: targetDuration + transitionOverlap
  // Because: actualVideoDuration = sum(sceneDurations) - transitionOverlap
  const adjustedTarget = targetDuration + transitionOverlap;
  
  // Calculate current total
  let currentTotal = adjustedScenes.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  let difference = adjustedTarget - currentTotal;
  
  console.log(`[Duration Fix] Scene total: ${currentTotal}s, Target: ${targetDuration}s, Transition overlap: ${transitionOverlap}s`);
  console.log(`[Duration Fix] Adjusted target (with overlap): ${adjustedTarget}s, Diff: ${difference}s`);
  
  // ALWAYS ensure exact match - this prevents video pause at end
  if (Math.abs(difference) < 0.05) {
    console.log(`[Duration Fix] Already close enough, no adjustment needed`);
    return adjustedScenes;
  }
  
  if (difference > 0) {
    // Video is TOO SHORT - need to extend scenes
    console.log(`[Duration Fix] Extending video by ${difference}s`);
    
    // Distribute proportionally
    const adjustmentFactor = adjustedTarget / currentTotal;
    adjustedScenes.forEach(scene => {
      scene.durationSec = Math.round(scene.durationSec * adjustmentFactor * 10) / 10;
    });
    
    // Verify and fix rounding errors
    currentTotal = adjustedScenes.reduce((sum, s) => sum + s.durationSec, 0);
    difference = adjustedTarget - currentTotal;
    
    if (Math.abs(difference) > 0.05) {
      adjustedScenes[adjustedScenes.length - 1].durationSec += difference;
      console.log(`[Duration Fix] Added ${difference}s to last scene`);
    }
  } else {
    // Video is TOO LONG - need to shorten scenes
    console.log(`[Duration Fix] Shortening video by ${Math.abs(difference)}s`);
    
    const adjustmentFactor = adjustedTarget / currentTotal;
    adjustedScenes.forEach(scene => {
      scene.durationSec = Math.max(2, Math.round(scene.durationSec * adjustmentFactor * 10) / 10);
    });
    
    // Verify and fix rounding errors
    currentTotal = adjustedScenes.reduce((sum, s) => sum + s.durationSec, 0);
    difference = adjustedTarget - currentTotal;
    
    if (Math.abs(difference) > 0.05) {
      adjustedScenes[adjustedScenes.length - 1].durationSec = Math.max(2, 
        adjustedScenes[adjustedScenes.length - 1].durationSec + difference
      );
    }
  }
  
  // Final validation
  const finalTotal = adjustedScenes.reduce((sum, s) => sum + s.durationSec, 0);
  const effectiveDuration = finalTotal - transitionOverlap;
  console.log(`[Duration Fix] Final scene total: ${finalTotal}s, Effective video duration: ${effectiveDuration}s (target: ${targetDuration}s)`);
  
  // CRITICAL: If still not matching, force last scene to match
  if (Math.abs(effectiveDuration - targetDuration) > 0.1) {
    const lastScene = adjustedScenes[adjustedScenes.length - 1];
    const adjustment = targetDuration - effectiveDuration;
    lastScene.durationSec = Math.max(2, lastScene.durationSec + adjustment);
    console.log(`[Duration Fix] Force-adjusted last scene by ${adjustment}s`);
  }
  
  return adjustedScenes;
}

// ============================================================================
// Helper: Call an agent with its specific context
// ============================================================================
async function callAgent(
  systemPrompt: string,
  userPrompt: string,
  agentName: string
): Promise<any> {
  console.log(`[${agentName}] Starting...`);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 16000, // gpt-4o supports max 16384 completion tokens
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`${agentName} returned no response`);
  }

  if (completion.choices[0]?.finish_reason === "length") {
    console.warn(`[${agentName}] Response was truncated`);
  }

  try {
    const result = JSON.parse(content);
    console.log(`[${agentName}] Success`);
    return result;
  } catch {
    console.error(`[${agentName}] Invalid JSON:`, content.slice(-200));
    throw new Error(`${agentName} returned invalid JSON`);
  }
}

// ============================================================================
// Main Route Handler
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      title,
      script, 
      description,
      voiceoverAssetId,
      voiceoverDurationSec,
      voiceoverVolume,
      selectedAssets,
      timedCaptions,
      captionSegments,
      selectedMusicId,
      musicVolume,
      resolution,
      captionSettings,
      // Talking head mode specific
      talkingHeadMode,
      talkingHeadAssetId,
      talkingHeadDuration,
      brollFrequency,
      brollLength,
      enableCaptions,
    } = body as {
      title: string;
      script?: string;
      description?: string;
      voiceoverAssetId?: string | null;
      voiceoverDurationSec?: number;
      voiceoverVolume?: number;
      selectedAssets?: string[];
      timedCaptions?: string;
      captionSegments?: Array<{ start: number; end: number; text: string }>;
      selectedMusicId?: string;
      resolution?: { width: number; height: number };
      musicVolume?: number;
      captionSettings?: {
        enabled: boolean;
        wordsPerBlock?: number;
        font?: string;
      };
      // Talking head mode
      talkingHeadMode?: boolean;
      talkingHeadAssetId?: string;
      talkingHeadDuration?: number;
      brollFrequency?: "low" | "medium" | "high";
      brollLength?: number;
      enableCaptions?: boolean;
    };

    // Fetch user settings for intro/outro
    let introAsset: { id: string; public_url: string; duration_sec: number } | null = null;
    let outroAsset: { id: string; public_url: string; duration_sec: number } | null = null;
    
    try {
      const { data: userSettings } = await adminSupabase
        .from("user_settings")
        .select("intro_asset_id, outro_asset_id, always_use_intro, always_use_outro")
        .eq("user_id", user.id)
        .single();

      if (userSettings?.always_use_intro && userSettings?.intro_asset_id) {
        const { data: intro } = await adminSupabase
          .from("media_assets")
          .select("id, public_url, duration_sec")
          .eq("id", userSettings.intro_asset_id)
          .single();
        if (intro) introAsset = intro;
      }

      if (userSettings?.always_use_outro && userSettings?.outro_asset_id) {
        const { data: outro } = await adminSupabase
          .from("media_assets")
          .select("id, public_url, duration_sec")
          .eq("id", userSettings.outro_asset_id)
          .single();
        if (outro) outroAsset = outro;
      }
    } catch (settingsError) {
      console.log("[Build Timeline] No user settings found, skipping intro/outro");
    }
    
    const introDuration = introAsset?.duration_sec || 0;
    const outroDuration = outroAsset?.duration_sec || 0;
    
    console.log(`[Build Timeline] Intro: ${introDuration}s, Outro: ${outroDuration}s`);

    // ========================================================================
    // TALKING HEAD MODE - Different flow for talking head videos
    // ========================================================================
    if (talkingHeadMode && talkingHeadAssetId) {
      console.log(`[Build Timeline] TALKING HEAD MODE`);
      console.log(`[Build Timeline] Asset: ${talkingHeadAssetId}, Duration: ${talkingHeadDuration}s`);
      console.log(`[Build Timeline] B-roll frequency: ${brollFrequency}, length: ${brollLength}s`);
      console.log(`[Build Timeline] Music selected: ${selectedMusicId || "none"}, volume: ${musicVolume}`);
      
      // Fetch the talking head asset
      const { data: talkingHeadAsset, error: thError } = await adminSupabase
        .from("media_assets")
        .select("*")
        .eq("id", talkingHeadAssetId)
        .single();
      
      // Fetch music if selected for talking head
      let talkingHeadMusic: { id: string; audio_url: string; title: string } | null = null;
      if (selectedMusicId) {
        const { data: musicData } = await adminSupabase
          .from("music")
          .select("id, audio_url, title")
          .eq("id", selectedMusicId)
          .single();
        if (musicData) {
          talkingHeadMusic = musicData;
          console.log(`[Build Timeline] Using music: "${musicData.title}" (${musicData.audio_url ? "has URL" : "NO URL!"})`);
        }
      }
        
      if (thError || !talkingHeadAsset) {
        return NextResponse.json({ error: "Talking head asset not found" }, { status: 404 });
      }
      
      const videoDuration = talkingHeadDuration || talkingHeadAsset.duration_sec || 60;
      
      // Calculate b-roll intervals based on frequency
      const frequencyMap = {
        low: 15,    // B-roll every 15 seconds
        medium: 10, // B-roll every 10 seconds
        high: 6,    // B-roll every 6 seconds
      };
      const brollInterval = frequencyMap[brollFrequency || "medium"];
      const brollClipLength = brollLength || 3;
      
      // Calculate number of b-roll insertions
      const numBrolls = Math.floor(videoDuration / brollInterval);
      console.log(`[Build Timeline] Will insert ${numBrolls} b-roll clips at ${brollInterval}s intervals`);
      
      // Fetch b-roll clips
      const { data: brollClips } = await adminSupabase
        .from("clips")
        .select("id, description, duration_seconds, clip_link, tags")
        .gte("duration_seconds", brollClipLength)
        .limit(50);
      
      if (!brollClips || brollClips.length === 0) {
        console.log("[Build Timeline] No b-roll clips available, creating simple timeline");
      }
      
      // Use AI to select relevant b-roll clips based on description
      let brollOverlays: Array<{
        clipId: string;
        clipUrl: string;
        startTime: number;
        duration: number;
        description: string;
      }> = [];
      
      if (brollClips && brollClips.length > 0 && numBrolls > 0) {
        const brollPrompt = `You are selecting b-roll video clips to overlay on a talking head video.

The user's description of what b-roll they want: "${description || "relevant b-roll for the content"}"

Available b-roll clips:
${brollClips.slice(0, 30).map(c => `- ID: ${c.id}, Description: "${c.description?.slice(0, 100) || 'No description'}", Tags: [${(c.tags || []).slice(0, 5).join(", ")}]`).join("\n")}

Select ${Math.min(numBrolls, brollClips.length)} DIFFERENT clips that best match the user's description.

RESPOND WITH ONLY THIS JSON:
{
  "selectedClips": [
    { "clipId": "uuid", "reason": "brief reason for selection" }
  ]
}`;

        try {
          const brollResult = await callAgent(
            "You select relevant b-roll clips. Always respond with valid JSON.",
            brollPrompt,
            "BROLL_SELECTOR"
          );
          
          // Build b-roll overlays at calculated intervals
          const selectedClipIds = brollResult.selectedClips || [];
          let clipIndex = 0;
          
          for (let i = 1; i <= numBrolls && clipIndex < selectedClipIds.length; i++) {
            const startTime = i * brollInterval - brollClipLength; // Insert before the interval point
            if (startTime < 0 || startTime + brollClipLength > videoDuration) continue;
            
            const selected = selectedClipIds[clipIndex];
            const clip = brollClips.find(c => c.id === selected.clipId);
            
            if (clip && clip.clip_link) {
              brollOverlays.push({
                clipId: clip.id,
                clipUrl: clip.clip_link,
                startTime: Math.max(2, startTime), // Don't start in first 2 seconds
                duration: Math.min(brollClipLength, clip.duration_seconds),
                description: clip.description || "",
              });
              clipIndex++;
            }
          }
        } catch (aiError) {
          console.error("[Build Timeline] B-roll selection failed:", aiError);
          // Fallback: randomly select clips
          for (let i = 0; i < Math.min(numBrolls, brollClips.length); i++) {
            const clip = brollClips[i];
            const startTime = (i + 1) * brollInterval - brollClipLength;
            if (startTime > 0 && startTime + brollClipLength < videoDuration && clip.clip_link) {
              brollOverlays.push({
                clipId: clip.id,
                clipUrl: clip.clip_link,
                startTime,
                duration: Math.min(brollClipLength, clip.duration_seconds),
                description: clip.description || "",
              });
            }
          }
        }
      }
      
      console.log(`[Build Timeline] Created ${brollOverlays.length} b-roll segments`);
      
      // Create the project ID
      const projectId = uuid();
      
      // Build interleaved scenes (talking head + b-roll cuts)
      // This creates a proper scene list that alternates between talking head and b-roll
      const interleavedScenes: any[] = [];
      let currentTime = 0;
      let sceneIndex = 0;
      
      // Sort b-roll by start time
      const sortedBroll = [...brollOverlays].sort((a, b) => a.startTime - b.startTime);
      let brollIdx = 0;
      
      while (currentTime < videoDuration) {
        const nextBroll = sortedBroll[brollIdx];
        
        if (nextBroll && nextBroll.startTime > currentTime) {
          // Add talking head segment until next b-roll
          const segmentDuration = nextBroll.startTime - currentTime;
          interleavedScenes.push({
            id: `scene-th-${sceneIndex++}`,
            assetId: talkingHeadAsset.id,
            clipId: talkingHeadAsset.id,
            clipUrl: talkingHeadAsset.public_url,
            intent: "Talking head footage",
            clipDescription: (talkingHeadAsset.metadata as any)?.description || talkingHeadAsset.filename,
            isUserAsset: true,
            isTalkingHead: true,
            kind: "video" as const,
            inSec: currentTime, // Start from where we are in the source
            outSec: currentTime + segmentDuration,
            durationSec: segmentDuration,
            cropMode: "cover" as const,
            overlays: { title: null, subtitle: null, position: "lower_third" as const, stylePreset: "minimal" as const },
            transitionOut: "fade",
            transitionDuration: 0.3,
            // Track source audio timing for the render worker
            sourceAudioStart: currentTime,
            sourceAudioEnd: currentTime + segmentDuration,
          });
          currentTime = nextBroll.startTime;
        }
        
        if (nextBroll && currentTime >= nextBroll.startTime) {
          // Add b-roll scene
          const brollDuration = Math.min(nextBroll.duration, videoDuration - currentTime);
          if (brollDuration > 0) {
            interleavedScenes.push({
              id: `scene-br-${sceneIndex++}`,
              assetId: null,
              clipId: nextBroll.clipId,
              clipUrl: nextBroll.clipUrl,
              intent: nextBroll.description || "B-roll footage",
              clipDescription: nextBroll.description || "B-roll",
              isUserAsset: false,
              isBroll: true,
              kind: "video" as const,
              inSec: 0, // Start from beginning of b-roll clip
              outSec: brollDuration,
              durationSec: brollDuration,
              cropMode: "cover" as const,
              overlays: { title: null, subtitle: null, position: "lower_third" as const, stylePreset: "minimal" as const },
              transitionOut: "fade",
              transitionDuration: 0.3,
              // Track source audio timing - b-roll plays while talking head audio continues
              sourceAudioStart: currentTime,
              sourceAudioEnd: currentTime + brollDuration,
            });
          }
          currentTime += brollDuration;
          brollIdx++;
        } else if (!nextBroll) {
          // No more b-roll - add remaining talking head
          const remainingDuration = videoDuration - currentTime;
          if (remainingDuration > 0.1) {
            interleavedScenes.push({
              id: `scene-th-${sceneIndex++}`,
              assetId: talkingHeadAsset.id,
              clipId: talkingHeadAsset.id,
              clipUrl: talkingHeadAsset.public_url,
              intent: "Talking head footage",
              clipDescription: (talkingHeadAsset.metadata as any)?.description || talkingHeadAsset.filename,
              isUserAsset: true,
              isTalkingHead: true,
              kind: "video" as const,
              inSec: currentTime,
              outSec: videoDuration,
              durationSec: remainingDuration,
              cropMode: "cover" as const,
              overlays: { title: null, subtitle: null, position: "lower_third" as const, stylePreset: "minimal" as const },
              transitionOut: null,
              transitionDuration: 0,
              sourceAudioStart: currentTime,
              sourceAudioEnd: videoDuration,
            });
          }
          break;
        }
      }
      
      // If no b-roll was added, just use the full talking head video
      if (interleavedScenes.length === 0) {
        interleavedScenes.push({
          id: "scene-main",
          assetId: talkingHeadAsset.id,
          clipId: talkingHeadAsset.id,
          clipUrl: talkingHeadAsset.public_url,
          intent: "Main talking head footage",
          clipDescription: (talkingHeadAsset.metadata as any)?.description || talkingHeadAsset.filename,
          isUserAsset: true,
          isTalkingHead: true,
          kind: "video" as const,
          inSec: 0,
          outSec: videoDuration,
          durationSec: videoDuration,
          cropMode: "cover" as const,
          overlays: { title: null, subtitle: null, position: "lower_third" as const, stylePreset: "minimal" as const },
          transitionOut: null,
          transitionDuration: 0,
        });
      }
      
      console.log(`[Build Timeline] Created ${interleavedScenes.length} interleaved scenes (${interleavedScenes.filter((s: any) => s.isBroll).length} b-roll)`);
      
      // Build the talking head timeline with interleaved scenes
      const talkingHeadTimeline = {
        version: 1 as const,
        project: {
          id: projectId,
          title: title || "Talking Head Video",
          type: "talking_head",
          aspectRatio: "landscape" as const,
          resolution: resolution || { width: 1920, height: 1080 },
          fps: 30,
        },
        scenes: interleavedScenes,
        // Store the talking head asset info for the render worker to use as audio source
        talkingHeadSource: {
          assetId: talkingHeadAsset.id,
          assetUrl: talkingHeadAsset.public_url,
          duration: videoDuration,
        },
        soundEffects: [],
        imageOverlays: [],
        global: {
          // Use selected music if provided
          music: { 
            assetId: talkingHeadMusic?.id || null, 
            audioUrl: talkingHeadMusic?.audio_url || null, 
            title: talkingHeadMusic?.title || null, 
            volume: musicVolume ?? 0.2,
          },
          // Use talking head video as the audio source
          voiceover: { 
            assetId: talkingHeadAsset.id, 
            audioUrl: talkingHeadAsset.public_url,
            volume: 1.0, 
            startOffset: 0,
            isTalkingHeadAudio: true,
          },
          captions: { 
            enabled: enableCaptions || false, 
            burnIn: enableCaptions || false,
            wordsPerBlock: 3,
            font: "Inter",
            srtAssetId: null,
            startOffset: 0,
            segments: [],
          },
          brand: {
            presetId: null,
            logoAssetId: null,
            logoPosition: "top-right" as const,
            logoSize: 80,
            colors: { primary: "#00b4d8", secondary: "#0077b6", accent: "#ff6b6b", text: "#ffffff" },
            safeMargins: { top: 50, bottom: 50, left: 50, right: 50 },
          },
          export: { codec: "h264" as const, crf: 23, bitrateMbps: 8, audioKbps: 192 },
        },
        rendering: {
          output: { url: null, thumbnailUrl: null, durationSec: null, sizeBytes: null },
          voiceoverDurationSec: videoDuration,
          totalDurationSec: videoDuration,
          introDurationSec: 0,
          outroDurationSec: 0,
        },
        formOptions: {
          talkingHeadMode: true,
          talkingHeadAssetId,
          brollFrequency,
          brollLength,
          enableCaptions,
          description,
        },
      };
      
      // Create project
      const { data: project, error: projectError } = await adminSupabase
        .from("projects")
        .insert({
          owner_id: user.id,
          title: title || "Talking Head Video",
          type: "talking_head",
          timeline_json: talkingHeadTimeline,
          status: "draft",
          duration_sec: videoDuration,
          script: null,
          description: description || null,
        })
        .select()
        .single();

      if (projectError || !project) {
        console.error("Project creation error:", projectError);
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
      }

      console.log(`[Build Timeline] Talking head project created with ${brollOverlays.length} b-roll overlays`);

      return NextResponse.json({
        projectId: project.id,
        timeline: talkingHeadTimeline,
        totalDurationSec: videoDuration,
        brollCount: brollOverlays.length,
      });
    }
    
    // ========================================================================
    // STANDARD VOICEOVER MODE - Requires script and duration
    // ========================================================================
    if (!script || !voiceoverDurationSec || voiceoverDurationSec <= 0) {
      return NextResponse.json({ error: "Script and duration are required for voiceover videos" }, { status: 400 });
    }

    // ========================================================================
    // SMART RETRIEVAL: Get relevant clips using tag/text search
    // CRITICAL: Never send full clip database to AI - only a shortlist
    // ========================================================================
    
    const targetResolution = resolution 
      ? (resolution.height === 2160 ? "4k" : resolution.height === 1080 ? "1080p" : "720p")
      : "1080p";
    
    console.log(`[Build Timeline] Resolution: ${targetResolution}`);
    
    // Extract key terms from script for retrieval
    // This helps find relevant clips without sending everything to AI
    const scriptLower = script.toLowerCase();
    const potentialIndustries = [
      "real_estate", "ecommerce", "fitness", "finance", "restaurant", 
      "tech", "education", "healthcare", "travel", "automotive",
      "beauty", "fashion", "construction", "legal", "consulting"
    ];
    
    // Detect industry from script
    let detectedIndustry: string | undefined;
    for (const industry of potentialIndustries) {
      if (scriptLower.includes(industry.replace("_", " ")) || 
          scriptLower.includes(industry.replace("_", ""))) {
        detectedIndustry = industry;
        break;
      }
    }
    // Also check common keywords
    if (!detectedIndustry) {
      if (scriptLower.includes("property") || scriptLower.includes("home") || scriptLower.includes("house")) {
        detectedIndustry = "real_estate";
      } else if (scriptLower.includes("gym") || scriptLower.includes("workout") || scriptLower.includes("exercise")) {
        detectedIndustry = "fitness";
      } else if (scriptLower.includes("shop") || scriptLower.includes("product") || scriptLower.includes("buy")) {
        detectedIndustry = "ecommerce";
      }
    }
    
    console.log(`[Build Timeline] Detected industry: ${detectedIndustry || "none"}`);
    
    // Call retrieval API to get shortlist of relevant clips
    const retrievalResponse = await fetch(new URL("/api/clips/retrieve", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: script.slice(0, 500), // Use first 500 chars of script for text search
        resolution: targetResolution,
        industry: detectedIndustry,
        limit: 150, // Get up to 150 most relevant clips
      }),
    });
    
    if (!retrievalResponse.ok) {
      console.error("[Build Timeline] Retrieval failed");
      // Fallback to direct query if retrieval fails
    }
    
    const retrievalData = await retrievalResponse.json();
    let clips = retrievalData.clips || [];
    
    console.log(`[Build Timeline] Retrieved ${clips.length} clips from shortlist`);
    
    // If retrieval returned no clips, fallback to basic query
    if (clips.length === 0) {
      console.log("[Build Timeline] Fallback: Direct clip query");
      const { data: fallbackClips } = await adminSupabase
        .from("clips")
        .select("id, description, duration_seconds, source_resolution, clip_link")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (fallbackClips) {
        clips = fallbackClips.map(c => ({
          id: c.id,
          duration: c.duration_seconds,
          description: c.description || "No description",
          tags: [],
          resolution: c.source_resolution || "1080p",
          clip_link: c.clip_link, // CRITICAL: Include the video URL!
        }));
      }
    }
    
    if (!clips || clips.length === 0) {
      return NextResponse.json({ 
        error: "No clips available. Please upload clips first." 
      }, { status: 400 });
    }
    
    // Log available clips for debugging
    console.log(`[Build Timeline] Available clips: ${clips.length}`);
    console.log(`[Build Timeline] Clip IDs: ${clips.slice(0, 10).map((c: any) => c.id.slice(0, 8)).join(", ")}${clips.length > 10 ? "..." : ""}`);
    console.log(`[Build Timeline] Clips with URLs: ${clips.filter((c: any) => c.clip_link).length}`);
    
    // Validate clips have required data
    const validClips = clips.filter((c: any) => c.id && c.duration && c.clip_link);
    if (validClips.length < clips.length) {
      console.warn(`[Build Timeline] ${clips.length - validClips.length} clips missing required data (id, duration, or clip_link)`);
    }
    
    // Fetch audio assets (these are typically few, so we can load all)
    const [
      { data: musicTracks, error: musicError },
      { data: soundEffects },
      { data: overlays },
    ] = await Promise.all([
      adminSupabase.from("music").select("*"),
      adminSupabase.from("sound_effects").select("*"),
      adminSupabase.from("overlays").select("*"),
    ]);
    
    // Debug logging for music
    console.log(`[Build Timeline] Music tracks fetched: ${musicTracks?.length || 0} tracks`);
    if (musicError) {
      console.error(`[Build Timeline] Music fetch error:`, musicError);
    }
    if (musicTracks && musicTracks.length > 0) {
      console.log(`[Build Timeline] First music track sample:`, JSON.stringify(musicTracks[0]));
    }
    console.log(`[Build Timeline] Incoming selectedMusicId: "${selectedMusicId}", musicVolume: ${musicVolume}`);

    // Fetch user assets if any are selected
    let userAssets: Array<{
      id: string;
      filename: string;
      public_url: string;
      duration_sec: number | null;
      metadata: { name?: string; description?: string } | null;
    }> = [];
    
    if (selectedAssets && selectedAssets.length > 0) {
      const { data: assets } = await adminSupabase
        .from("media_assets")
        .select("id, filename, public_url, duration_sec, metadata")
        .in("id", selectedAssets);
      userAssets = assets || [];
    }

    // ========================================================================
    // AGENT 1: Clip Selection - ONLY sees SHORTLIST of clips (max 150)
    // CRITICAL: We never send the full clip database to AI
    // ========================================================================
    let clipContext = `AVAILABLE VIDEO CLIPS (${clips.length} pre-filtered for relevance):\n`;
    clipContext += clips.map((clip: any) => {
      // Include scene changes if available - helps AI know where clean cuts are
      const sceneInfo = clip.scene_changes?.length > 0 
        ? `, Scene cuts at: [${clip.scene_changes.slice(0, 5).map((s: any) => `${s.timestamp}s`).join(", ")}${clip.scene_changes.length > 5 ? "..." : ""}]`
        : "";
      return `- ID: ${clip.id}, Duration: ${clip.duration || clip.duration_seconds}s, Desc: "${clip.description?.slice(0, 80) || "No description"}", Tags: [${(clip.tags || []).slice(0, 8).join(", ")}]${sceneInfo}`;
    }).join("\n");

    if (userAssets.length > 0) {
      clipContext += "\n\nUSER ASSETS (YOU MUST INCLUDE ALL OF THESE):\n";
      clipContext += userAssets.map(asset => {
        const meta = asset.metadata || {};
        return `- ID: ${asset.id}, Duration: ${asset.duration_sec || 5}s, Description: ${meta.description || meta.name || asset.filename} [REQUIRED]`;
      }).join("\n");
    }

    // Round up to nearest whole number
    const targetDurationCeil = Math.ceil(voiceoverDurationSec);
    
    const clipPrompt = `EXACT TARGET DURATION: ${targetDurationCeil} seconds (rounded up from ${voiceoverDurationSec}s)

Script:
"${script}"
${timedCaptions ? `\nTIMED CAPTIONS:\n${timedCaptions}` : ""}

${clipContext}

Your scenes MUST total EXACTLY ${targetDurationCeil} seconds. Calculate: sum all durationSec values = ${targetDurationCeil}`;

    const clipResult = await callAgent(CLIP_AGENT_PROMPT, clipPrompt, "CLIP_AGENT");
    
    // CRITICAL: Normalize scene durations to match target exactly
    // This prevents video freezing when clips don't add up to voiceover duration
    if (clipResult.scenes && clipResult.scenes.length > 0) {
      clipResult.scenes = normalizeSceneDurations(clipResult.scenes, targetDurationCeil);
    }

    // ========================================================================
    // AGENT 2: Audio Selection - ONLY sees music and SFX
    // ========================================================================
    let audioContext = "";
    
    if (musicTracks && musicTracks.length > 0) {
      audioContext += "AVAILABLE MUSIC TRACKS:\n";
      audioContext += musicTracks.map((track: any) => 
        `- ID: ${track.id}, Title: "${track.title}", Artist: ${track.artist || "Unknown"}, Duration: ${track.duration_seconds}s, Mood: ${track.mood?.join(", ") || "Various"}`
      ).join("\n");
    } else {
      audioContext += "No music tracks available.\n";
    }

    if (soundEffects && soundEffects.length > 0) {
      audioContext += "\n\nAVAILABLE SOUND EFFECTS:\n";
      audioContext += soundEffects.map((sfx: any) => 
        `- ID: ${sfx.id}, Title: "${sfx.title}", Description: "${sfx.description || 'No description'}", Duration: ${sfx.duration_seconds}s`
      ).join("\n");
    } else {
      audioContext += "\nNo sound effects available.";
    }

    let audioPrompt = `Video duration: ${voiceoverDurationSec} seconds

Script:
"${script}"

${audioContext}`;

    // If user pre-selected music, tell the agent
    if (selectedMusicId && musicTracks) {
      const selectedTrack = musicTracks.find((t: any) => t.id === selectedMusicId);
      if (selectedTrack) {
        audioPrompt += `\n\nUSER SELECTED THIS MUSIC (use it): ID: ${selectedTrack.id}, Title: "${selectedTrack.title}"`;
      }
    }

    const audioResult = await callAgent(AUDIO_AGENT_PROMPT, audioPrompt, "AUDIO_AGENT");

    // ========================================================================
    // AGENT 3: Overlay Selection - ONLY sees overlays
    // ========================================================================
    let overlayContext = "";
    
    if (overlays && overlays.length > 0) {
      overlayContext = "AVAILABLE OVERLAYS (images/GIFs that appear ON TOP of video):\n";
      overlayContext += overlays.map((o: any) => 
        `- ID: ${o.id}, Title: "${o.title}", Description: "${o.description || 'No description'}", Size: ${o.width || "auto"}x${o.height || "auto"}`
      ).join("\n");
    } else {
      overlayContext = "No overlays available.";
    }

    const overlayPrompt = `Video duration: ${voiceoverDurationSec} seconds

Script:
"${script}"

${overlayContext}

Add overlays where they would enhance the video (or none if not needed).`;

    const overlayResult = await callAgent(OVERLAY_AGENT_PROMPT, overlayPrompt, "OVERLAY_AGENT");

    // ========================================================================
    // AGENT 4: Text Effect Selection - Adds text overlays from effects library
    // ========================================================================
    const textEffectPrompt = `Video duration: ${voiceoverDurationSec} seconds

Script:
"${script}"

Add text effects to enhance key moments in the video. Remember: 2 seconds per word minimum!`;

    const textEffectResult = await callAgent(TEXT_EFFECT_AGENT_PROMPT, textEffectPrompt, "TEXT_EFFECT_AGENT");

    // ========================================================================
    // COMBINE RESULTS: Build the final timeline
    // ========================================================================
    const clipMap = new Map(clips.map((c: any) => [c.id, c]));
    const userAssetIds = new Set(userAssets.map(a => a.id));
    const validClipIds = new Set(clips.map((c: any) => c.id));
    
    // Debug: Check if clips have clip_link
    const clipsWithoutUrl = clips.filter((c: any) => !c.clip_link);
    if (clipsWithoutUrl.length > 0) {
      console.error(`[Build Timeline] WARNING: ${clipsWithoutUrl.length}/${clips.length} clips missing clip_link!`);
      console.error(`[Build Timeline] Missing IDs: ${clipsWithoutUrl.slice(0, 5).map((c: any) => c.id).join(", ")}...`);
    }

    // Build scenes from clip agent response
    // IMPORTANT: Track used clips to prevent duplicates
    const usedClipIds = new Set<string>();
    
    const scenes = (clipResult.scenes || [])
      .filter((scene: any) => {
        const isUserAsset = userAssetIds.has(scene.clipId);
        const isValidClip = validClipIds.has(scene.clipId);
        
        if (!isUserAsset && !isValidClip) {
          console.warn(`Skipping invalid clip ID: ${scene.clipId}`);
          return false;
        }
        
        // Prevent duplicate clips (unless it's a user asset which can be reused)
        if (!isUserAsset && usedClipIds.has(scene.clipId)) {
          console.warn(`Skipping duplicate clip ID: ${scene.clipId} - already used`);
          return false;
        }
        
        if (!isUserAsset) {
          usedClipIds.add(scene.clipId);
        }
        
        return true;
      })
      .map((scene: any, index: number) => {
        const isUserAsset = userAssetIds.has(scene.clipId);
        const clip = clipMap.get(scene.clipId);
        const userAsset = userAssets.find(a => a.id === scene.clipId);

        let clipUrl: string | null = null;
        let assetId: string | null = null;
        let clipDescription = scene.intent || "";

        if (isUserAsset && userAsset) {
          assetId = userAsset.id;
          clipUrl = userAsset.public_url;
          clipDescription = userAsset.metadata?.description || userAsset.filename;
        } else if (clip) {
          clipUrl = clip.clip_link;
          clipDescription = clip.description || "";
          if (!clip.clip_link) {
            console.error(`[Build Timeline] Clip ${scene.clipId} has no clip_link!`, clip);
          }
        } else {
          console.error(`[Build Timeline] No clip found in clipMap for ID: ${scene.clipId}`);
        }

        return {
          id: `scene-${index + 1}`,
          assetId,
          clipId: scene.clipId,
          clipUrl,
          intent: scene.intent || `Scene ${index + 1}`,
          clipDescription,
          isUserAsset,
          kind: "video" as const,
          inSec: 0,
          outSec: scene.durationSec,
          durationSec: scene.durationSec,
          cropMode: "cover" as const,
          overlays: { title: null, subtitle: null, position: "lower_third" as const, stylePreset: "minimal" as const },
          transitionOut: scene.transitionOut || null,
          transitionDuration: scene.transitionDuration || 0.5,
        };
      });

    if (scenes.length === 0) {
      return NextResponse.json({ 
        error: "No valid clips selected. Please try again." 
      }, { status: 400 });
    }

    // Get music from audio agent or user selection
    const finalMusicId = selectedMusicId || audioResult.music?.trackId;
    const selectedMusic = finalMusicId 
      ? musicTracks?.find((t: any) => t.id === finalMusicId) 
      : null;
    // Increase default music volume to be more audible (0.5 = 50%)
    const finalMusicVolume = musicVolume ?? audioResult.music?.volume ?? 0.5;
    
    if (selectedMusic) {
      console.log(`[Build Timeline] Using music: "${selectedMusic.title}" (ID: ${selectedMusic.id})`);
      console.log(`[Build Timeline] Music audio_url: ${selectedMusic.audio_url || "MISSING!"}`);
      if (!selectedMusic.audio_url) {
        console.error(`[Build Timeline] WARNING: Music track has no audio_url!`, selectedMusic);
      }
    } else {
      console.log("[Build Timeline] No music selected");
      console.log(`[Build Timeline] selectedMusicId: ${selectedMusicId}, audioResult.music: ${JSON.stringify(audioResult.music)}`);
    }

    // Build sound effects (validate IDs)
    const validSfxIds = new Set(soundEffects?.map((s: any) => s.id) || []);
    const sfxList = (audioResult.soundEffects || [])
      .filter((sfx: any) => validSfxIds.has(sfx.effectId))
      .map((sfx: any) => {
        const effect = soundEffects?.find((e: any) => e.id === sfx.effectId);
        return {
          id: sfx.effectId,
          title: sfx.title || effect?.title || "Sound effect",
          audioUrl: effect?.audio_url || null,
          atTimeSec: sfx.atTimeSec,
          volume: sfx.volume || 0.5,
        };
      })
      .filter((sfx: any) => sfx.audioUrl);

    // Build overlays (validate IDs)
    const validOverlayIds = new Set(overlays?.map((o: any) => o.id) || []);
    const overlayList = (overlayResult.imageOverlays || [])
      .filter((io: any) => validOverlayIds.has(io.overlayId))
      .map((io: any) => {
        const overlay = overlays?.find((o: any) => o.id === io.overlayId);
        return {
          id: io.overlayId,
          title: io.title || overlay?.title || "Overlay",
          imageUrl: overlay?.image_url || null,
          atTimeSec: io.atTimeSec,
          durationSec: io.durationSec || 3,
          x: io.x || 50,
          y: io.y || 50,
          scale: io.scale || 1.0,
          width: overlay?.width || null,
          height: overlay?.height || null,
        };
      })
      .filter((io: any) => io.imageUrl);

    // Build text effects from effects library with proper timing
    // 0.4s per word is fast but readable for on-screen text
    const SECONDS_PER_WORD = 0.4;
    const MIN_EFFECT_DURATION = 2; // At least 2 seconds for any effect
    
    const textEffectsList = (textEffectResult.textEffects || []).map((te: any) => {
      // Calculate word count for timing
      let wordCount = 0;
      if (te.header) wordCount += te.header.split(/\s+/).length;
      if (te.body) wordCount += te.body.split(/\s+/).length;
      if (te.topText) wordCount += te.topText.split(/\s+/).length;
      if (te.bottomText) wordCount += te.bottomText.split(/\s+/).length;
      
      // Duration = max(minimum, words * 2s) + 1s for animation
      const calculatedDuration = Math.max(MIN_EFFECT_DURATION, wordCount * SECONDS_PER_WORD) + 1;
      
      return {
        effectId: te.effectId,
        atTimeSec: te.atTimeSec,
        durationSec: calculatedDuration,
        header: te.header,
        body: te.body,
        topText: te.topText,
        bottomText: te.bottomText,
        wordCount,
      };
    });
    
    console.log(`[Build Timeline] Text effects: ${textEffectsList.length}`);
    textEffectsList.forEach((te: any) => {
      console.log(`  - ${te.effectId} at ${te.atTimeSec}s for ${te.durationSec}s (${te.wordCount} words)`);
    });

    const projectId = uuid();

    // Build intro scene if applicable
    const introScene = introAsset ? {
      id: "scene-intro",
      assetId: introAsset.id,
      clipId: introAsset.id,
      clipUrl: introAsset.public_url,
      intent: "Intro",
      clipDescription: "User intro video",
      isUserAsset: true,
      isIntro: true,
      kind: "video" as const,
      inSec: 0,
      outSec: introDuration,
      durationSec: introDuration,
      cropMode: "cover" as const,
      overlays: { title: null, subtitle: null, position: "lower_third" as const, stylePreset: "minimal" as const },
      transitionOut: "fade",
      transitionDuration: 0.5,
    } : null;

    // Build outro scene if applicable
    const outroScene = outroAsset ? {
      id: "scene-outro",
      assetId: outroAsset.id,
      clipId: outroAsset.id,
      clipUrl: outroAsset.public_url,
      intent: "Outro",
      clipDescription: "User outro video",
      isUserAsset: true,
      isOutro: true,
      kind: "video" as const,
      inSec: 0,
      outSec: outroDuration,
      durationSec: outroDuration,
      cropMode: "cover" as const,
      overlays: { title: null, subtitle: null, position: "lower_third" as const, stylePreset: "minimal" as const },
      transitionOut: null,
      transitionDuration: 0,
    } : null;

    // Combine all scenes: intro + main scenes + outro
    const allScenes = [
      ...(introScene ? [introScene] : []),
      ...scenes,
      ...(outroScene ? [outroScene] : []),
    ];

    // Calculate total duration including intro/outro
    const totalDuration = introDuration + voiceoverDurationSec + outroDuration;

    // If intro exists, shift all voiceover and overlays by intro duration
    const voiceoverStartOffset = introDuration;

    const timelineJson = {
      version: 1 as const,
      project: {
        id: projectId,
        title: title || "AI Generated Video",
        type: "ai_generated",
        aspectRatio: "landscape" as const,
        resolution: resolution || { width: 1920, height: 1080 },
        fps: 30,
      },
      scenes: allScenes,
      soundEffects: sfxList.map((sfx: any) => ({
        ...sfx,
        // Offset SFX timing by intro duration
        atTimeSec: sfx.atTimeSec + voiceoverStartOffset,
      })),
      imageOverlays: overlayList.map((io: any) => ({
        ...io,
        // Offset overlay timing by intro duration
        atTimeSec: io.atTimeSec + voiceoverStartOffset,
      })),
      textEffects: textEffectsList.map((te: any) => ({
        ...te,
        // Offset effect timing by intro duration
        atTimeSec: te.atTimeSec + voiceoverStartOffset,
      })),
      global: {
        music: { 
          assetId: selectedMusic?.id || null, 
          audioUrl: selectedMusic?.audio_url || null,
          title: selectedMusic?.title || null,
          volume: finalMusicVolume,
        },
        voiceover: { 
          assetId: voiceoverAssetId, 
          volume: voiceoverVolume ?? 1.0,
          startOffset: voiceoverStartOffset, // Voiceover starts after intro
        },
        captions: { 
          enabled: captionSettings?.enabled || false, 
          burnIn: captionSettings?.enabled || false, 
          wordsPerBlock: captionSettings?.wordsPerBlock || 3,
          font: captionSettings?.font || "Inter",
          srtAssetId: null,
          startOffset: voiceoverStartOffset, // Captions also offset by intro
          // Store actual caption segments with timing (offset by intro duration)
          segments: captionSegments?.map(seg => ({
            start: seg.start + voiceoverStartOffset,
            end: seg.end + voiceoverStartOffset,
            text: seg.text,
          })) || [],
        },
        brand: {
          presetId: null,
          logoAssetId: null,
          logoPosition: "top-right" as const,
          logoSize: 80,
          colors: { primary: "#00b4d8", secondary: "#0077b6", accent: "#ff6b6b", text: "#ffffff" },
          safeMargins: { top: 50, bottom: 50, left: 50, right: 50 },
        },
        export: { codec: "h264" as const, crf: 23, bitrateMbps: 8, audioKbps: 192 },
      },
      rendering: {
        output: { url: null, thumbnailUrl: null, durationSec: null, sizeBytes: null },
        voiceoverDurationSec: voiceoverDurationSec,
        totalDurationSec: totalDuration,
        introDurationSec: introDuration,
        outroDurationSec: outroDuration,
      },
      // Store all form options for debugging/testing
      formOptions: {
        selectedMusicId: selectedMusicId || null,
        musicVolume: musicVolume || null,
        voiceoverVolume: voiceoverVolume || null,
        selectedAssets: selectedAssets || [],
        timedCaptions: timedCaptions ? true : false,
        captionSettings: captionSettings || null,
        hasIntro: !!introAsset,
        hasOutro: !!outroAsset,
      },
    };

    // Create project
    const { data: project, error: projectError } = await adminSupabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: title || "AI Generated Video",
        type: "ai_generated",
        timeline_json: timelineJson,
        status: "draft",
        duration_sec: totalDuration,
        script: script,
        description: description || null,
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error("Project creation error:", projectError);
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    console.log(`Project created with ${scenes.length} scenes, ${sfxList.length} SFX, ${overlayList.length} overlays, ${textEffectsList.length} text effects`);

    return NextResponse.json({
      projectId: project.id,
      timeline: timelineJson,
      totalDurationSec: totalDuration,
      introDurationSec: introDuration,
      outroDurationSec: outroDuration,
    });
  } catch (error) {
    console.error("Timeline building error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build timeline" },
      { status: 500 }
    );
  }
}
