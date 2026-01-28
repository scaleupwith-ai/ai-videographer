import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { v4 as uuid } from "uuid";

/**
 * Build Talking Head Timeline API
 * 
 * Takes user videos with transcripts and creates a timeline that:
 * 1. Shows the user (talking head) speaking
 * 2. Cuts to relevant B-roll while audio continues
 * 3. Cuts back to user at key moments
 * 4. Adds captions and optional music
 */

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// B-roll frequency settings (approximate seconds between cuts)
const FREQUENCY_SETTINGS = {
  low: { minGap: 15, maxGap: 25 },
  medium: { minGap: 8, maxGap: 15 },
  high: { minGap: 4, maxGap: 10 },
};

// B-roll duration settings (seconds)
const DURATION_SETTINGS = {
  short: { min: 2, max: 4 },
  medium: { min: 4, max: 7 },
  long: { min: 7, max: 12 },
};

// Music volume map - LOUD for testing (will reduce later)
const VOLUME_MAP: Record<string, number> = {
  off: 0,
  faint: 0.5,
  low: 0.7,
  medium: 1.0,
};

interface VideoInput {
  assetId: string;
  duration: number;
  transcript: string;
  captions: Array<{ start: number; end: number; text: string }>;
}

interface Settings {
  enableCaptions: boolean;
  captionWordsPerBlock: number;
  captionFont: string;
  selectedMusicId: string | null;
  musicVolume: string;
  brollFrequency: "low" | "medium" | "high";
  brollDuration: "short" | "medium" | "long";
  brollPrompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const adminSupabase = getAdminSupabase();
    
    const body = await request.json();
    const { title, videos, settings } = body as {
      title: string;
      videos: VideoInput[];
      settings: Settings;
    };
    
    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: "No videos provided" }, { status: 400 });
    }
    
    console.log(`[Talking Head] Processing ${videos.length} videos`);
    
    // Calculate total duration
    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
    console.log(`[Talking Head] Total duration: ${totalDuration}s`);
    
    // Combine all transcripts
    const fullTranscript = videos.map(v => v.transcript).join(" ");
    
    // Get frequency and duration settings
    const freqSettings = FREQUENCY_SETTINGS[settings.brollFrequency];
    const durSettings = DURATION_SETTINGS[settings.brollDuration];
    
    // STEP 1: Extract key topics from transcript for better clip matching
    console.log(`[Talking Head] Extracting topics from transcript...`);
    const userPrompt = settings.brollPrompt?.trim() || "";
    
    const topicsResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "Extract 5-10 key visual topics/keywords from this transcript that would make good B-roll footage. Return as JSON: { \"topics\": [\"topic1\", \"topic2\", ...] }" 
        },
        { 
          role: "user", 
          content: userPrompt 
            ? `USER INSTRUCTIONS: ${userPrompt}\n\nTRANSCRIPT:\n${fullTranscript.slice(0, 2500)}`
            : fullTranscript.slice(0, 3000) 
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });
    
    const topicsData = JSON.parse(topicsResponse.choices[0].message.content || "{}");
    let topics: string[] = topicsData.topics || [];
    
    // If user provided a prompt, also extract keywords from it
    if (userPrompt) {
      const promptKeywords = userPrompt.toLowerCase()
        .split(/[\s,]+/)
        .filter(w => w.length > 3)
        .slice(0, 5);
      topics = [...new Set([...promptKeywords, ...topics])];
    }
    
    console.log(`[Talking Head] Extracted topics: ${topics.join(", ")}`);
    
    // STEP 2: Search for relevant clips using description AND tags
    let allMatchedClips: Array<{
      id: string;
      description: string;
      tags: string[];
      duration_seconds: number;
      clip_link: string;
      relevance: number;
    }> = [];
    
    // Search for each topic in BOTH description and tags
    for (const topic of topics) {
      const topicLower = topic.toLowerCase();
      
      // Search in description
      const { data: descMatches } = await adminSupabase
        .from("clips")
        .select("id, description, tags, duration_seconds, clip_link, scene_changes")
        .not("clip_link", "is", null)
        .ilike("description", `%${topic}%`)
        .limit(20);
      
      // Search in tags array (contains)
      const { data: tagMatches } = await adminSupabase
        .from("clips")
        .select("id, description, tags, duration_seconds, clip_link, scene_changes")
        .not("clip_link", "is", null)
        .contains("tags", [topicLower])
        .limit(20);
      
      // Combine results, boosting clips that match
      const allMatches = [...(descMatches || []), ...(tagMatches || [])];
      for (const clip of allMatches) {
        const existing = allMatchedClips.find(c => c.id === clip.id);
        if (existing) {
          existing.relevance += 1; // Boost clips that match multiple topics
        } else {
          allMatchedClips.push({ ...clip, tags: clip.tags || [], relevance: 1 });
        }
      }
    }
    
    // Also search for industry-specific tags (e.g., "waterproofing")
    // Extract potential industry terms from transcript
    const industryKeywords = topics.filter(t => 
      t.toLowerCase().includes("waterproof") || 
      t.toLowerCase().includes("construction") ||
      t.toLowerCase().includes("building") ||
      t.toLowerCase().includes("repair") ||
      t.toLowerCase().includes("roofing") ||
      t.toLowerCase().includes("plumbing")
    );
    
    for (const keyword of industryKeywords) {
      const keywordLower = keyword.toLowerCase();
      // Search tags that contain partial match
      const { data: industryMatches } = await adminSupabase
        .from("clips")
        .select("id, description, tags, duration_seconds, clip_link, scene_changes")
        .not("clip_link", "is", null)
        .or(`tags.cs.{${keywordLower}},description.ilike.%${keyword}%`)
        .limit(30);
      
      if (industryMatches) {
        for (const clip of industryMatches) {
          const existing = allMatchedClips.find(c => c.id === clip.id);
          if (existing) {
            existing.relevance += 2; // Higher boost for industry-specific matches
          } else {
            allMatchedClips.push({ ...clip, tags: clip.tags || [], relevance: 2 });
          }
        }
      }
    }
    
    // Also do a broader search with the full transcript keywords
    const transcriptWords = fullTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const uniqueWords = [...new Set(transcriptWords)].slice(0, 20);
    
    for (const word of uniqueWords) {
      // Search both description and tags
      const { data: matchedClips } = await adminSupabase
        .from("clips")
        .select("id, description, tags, duration_seconds, clip_link, scene_changes")
        .not("clip_link", "is", null)
        .or(`description.ilike.%${word}%,tags.cs.{${word}}`)
        .limit(10);
      
      if (matchedClips) {
        for (const clip of matchedClips) {
          if (!allMatchedClips.find(c => c.id === clip.id)) {
            allMatchedClips.push({ ...clip, tags: clip.tags || [], relevance: 0.5 });
          }
        }
      }
    }
    
    // Sort by relevance and take top matches
    allMatchedClips.sort((a, b) => b.relevance - a.relevance);
    const clips = allMatchedClips.slice(0, 50);
    
    // If no matches found, fall back to recent clips
    if (clips.length === 0) {
      console.log(`[Talking Head] No topic matches, falling back to recent clips`);
      const { data: recentClips } = await adminSupabase
      .from("clips")
        .select("id, description, tags, duration_seconds, clip_link, scene_changes")
      .not("clip_link", "is", null)
      .order("created_at", { ascending: false })
        .limit(50);
      
      if (recentClips) {
        clips.push(...recentClips.map(c => ({ ...c, tags: c.tags || [], relevance: 0 })));
      }
    }
    
    if (clips.length === 0) {
      return NextResponse.json({ 
        error: "No B-roll clips available. Please add clips first." 
      }, { status: 400 });
    }
    
    console.log(`[Talking Head] Found ${clips.length} relevant B-roll clips`);
    console.log(`[Talking Head] Top clips: ${clips.slice(0, 5).map(c => `${c.description?.slice(0, 30)}... (tags: ${c.tags?.join(', ')})`).join('; ')}`);
    
    // STEP 3: Build timed transcript segments for better clip matching
    // Combine captions into timed segments
    const timedSegments: Array<{ start: number; end: number; text: string }> = [];
    let segmentText = "";
    let segmentStart = 0;
    
    for (const video of videos) {
      const offset = videos.slice(0, videos.indexOf(video)).reduce((sum, v) => sum + v.duration, 0);
      for (const caption of video.captions) {
        if (segmentText.length === 0) {
          segmentStart = caption.start + offset;
        }
        segmentText += " " + caption.text;
        
        // Create segment every ~10 seconds or at sentence boundaries
        if (caption.end + offset - segmentStart >= 10 || caption.text.match(/[.!?]$/)) {
          timedSegments.push({
            start: segmentStart,
            end: caption.end + offset,
            text: segmentText.trim(),
          });
          segmentText = "";
        }
      }
    }
    if (segmentText.length > 0) {
      timedSegments.push({
        start: segmentStart,
        end: totalDuration,
        text: segmentText.trim(),
      });
    }
    
    // STEP 4: Use AI to select specific clips with FULL descriptions AND tags visible
    const userInstructions = userPrompt 
      ? `\n**USER INSTRUCTIONS (MUST FOLLOW):**\n${userPrompt}\n` 
      : "";
    
    const aiPrompt = `You are an expert video editor selecting B-roll footage for a talking head video.
${userInstructions}
**TIMED TRANSCRIPT (what the speaker says at each time):**
${timedSegments.map(s => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: "${s.text}"`).join("\n")}

**TOTAL VIDEO DURATION:** ${totalDuration} seconds

**AVAILABLE B-ROLL CLIPS:**
${clips.map((c, idx) => {
  // Include scene changes if available - helps AI know where clean cuts are
  const sceneInfo = c.scene_changes?.length > 0 
    ? `\n   Scene cuts at: [${c.scene_changes.slice(0, 5).map((s: any) => `${s.timestamp}s`).join(", ")}${c.scene_changes.length > 5 ? "..." : ""}]`
    : "";
  return `${idx + 1}. ID: ${c.id}
   Description: "${c.description || "No description"}"
   Tags: [${(c.tags || []).join(", ")}]
   Duration: ${c.duration_seconds}s${sceneInfo}`;
}).join("\n\n")}

**YOUR TASK:**
1. Read each timed segment of the transcript
2. For segments that discuss a VISUAL topic (something that can be shown), find a B-roll clip that matches
3. Select clips where the description or tags DIRECTLY relate to what's being discussed at that time

**B-ROLL TIMING RULES:**
- Insert B-roll every ${freqSettings.minGap}-${freqSettings.maxGap} seconds
- Each B-roll should last ${durSettings.min}-${durSettings.max} seconds
- MINIMUM 3 seconds per clip
- MINIMUM 3 seconds of talking head between B-roll cuts
- Start with at least 3-5 seconds of talking head visible
- End with talking head visible (no B-roll in last 3 seconds)
- Use DIFFERENT clips - never repeat the same clip

**CRITICAL: CLIP MATCHING**
- Only use a clip if its description/tags MATCH what's being discussed
- If talking about "waterproofing" - use clips with "waterproof" in description/tags
- If talking about "construction" - use clips showing construction work
- If no clip matches what's being said, DON'T insert B-roll there
- Quality over quantity - fewer well-matched clips is better than many random ones

**SCENE CHANGES (for smoother cuts):**
- Some clips show "Scene cuts at: [timestamps]" - these are detected camera/scene changes
- Use scene changes to pick CLEAN CUT POINTS for your B-roll duration
- Example: If clip has "Scene cuts at: [3.5s, 7.2s]", good durations are:
  - 3.5s (uses 0-3.5s, one complete scene)
  - 3.7s (uses 3.5-7.2s, another complete scene)
- This prevents awkward mid-scene cuts and creates smoother transitions
- If no scene changes listed, the clip is likely a single continuous shot

Return JSON:
{
  "brollInsertions": [
    {
      "startTime": 5.5,
      "duration": 4,
      "clipId": "uuid-from-list-above",
      "reason": "At 5.5s speaker discusses [topic], clip shows [matching content]"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional video editor. Respond only with valid JSON." },
        { role: "user", content: aiPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });
    
    const aiResponse = JSON.parse(completion.choices[0].message.content || "{}");
    const brollInsertions = aiResponse.brollInsertions || [];
    
    console.log(`[Talking Head] AI suggested ${brollInsertions.length} B-roll insertions`);
    
    // Fetch user assets (talking head videos)
    const userAssetIds = videos.map(v => v.assetId);
    const { data: userAssets } = await adminSupabase
      .from("media_assets")
      .select("id, public_url, duration_sec")
      .in("id", userAssetIds);
    
    if (!userAssets || userAssets.length === 0) {
      return NextResponse.json({ error: "User assets not found" }, { status: 400 });
    }
    
    // Build the scene list
    // IMPORTANT: B-roll REPLACES the visual during that time, it doesn't ADD time
    // Audio timeline = source video duration (continuous)
    // Visual timeline = same duration, but switches between talking head and B-roll
    const scenes: any[] = [];
    
    // Sort B-roll insertions by start time and filter invalid ones
    // Enforce minimum 3s duration for each clip and minimum 3s gap between clips
    const MIN_CLIP_DURATION = 3;
    const MIN_GAP_BETWEEN_CLIPS = 3;
    
    const sortedBroll = [...brollInsertions]
      .filter((b: any) => b.startTime >= 0 && b.startTime < totalDuration && b.duration >= MIN_CLIP_DURATION)
      .map((b: any) => ({
        ...b,
        duration: Math.max(b.duration, MIN_CLIP_DURATION), // Enforce minimum duration
      }))
      .sort((a: any, b: any) => a.startTime - b.startTime)
      .filter((b: any, index: number, arr: any[]) => {
        // Filter out clips that are too close to the previous one
        if (index === 0) return true;
        const prevEnd = arr[index - 1].startTime + arr[index - 1].duration;
        return b.startTime >= prevEnd + MIN_GAP_BETWEEN_CLIPS;
      });
    
    console.log(`[Talking Head] Filtered to ${sortedBroll.length} valid B-roll insertions (min ${MIN_CLIP_DURATION}s duration)`);
    
    // Helper to get current video asset and local time within the source
    const getCurrentVideo = (sourceTime: number) => {
      let accumulated = 0;
      for (let i = 0; i < videos.length; i++) {
        if (sourceTime < accumulated + videos[i].duration) {
          return {
            video: videos[i],
            asset: userAssets.find(a => a.id === videos[i].assetId),
            localTime: sourceTime - accumulated,
          };
        }
        accumulated += videos[i].duration;
      }
      // Return last video if we're past the end
      const lastVideo = videos[videos.length - 1];
      return {
        video: lastVideo,
        asset: userAssets.find(a => a.id === lastVideo.assetId),
        localTime: lastVideo.duration,
      };
    };
    
    // Build scenes by walking through the SOURCE video timeline
    // B-roll replaces visual at certain points, but doesn't change total duration
    let sourceTime = 0;
    let brollIndex = 0;
    
    while (sourceTime < totalDuration) {
      const nextBroll = sortedBroll[brollIndex];
      
      // Determine the end of the current talking head segment
      let segmentEnd: number;
      if (nextBroll && nextBroll.startTime > sourceTime) {
        // There's a B-roll coming up - show talking head until then
        segmentEnd = Math.min(nextBroll.startTime, totalDuration);
      } else if (nextBroll && nextBroll.startTime <= sourceTime) {
        // We're at or past a B-roll start time - show B-roll
        const brollClip = clips.find((c: any) => c.id === nextBroll.clipId);
        const brollDuration = Math.min(
          nextBroll.duration,
          totalDuration - sourceTime,
          brollClip?.duration_seconds || 10
        );
        
        if (brollClip && brollDuration > 0) {
          scenes.push({
            id: `scene-br-${scenes.length}`,
            assetId: null,
            clipId: brollClip.id,
            clipUrl: brollClip.clip_link,
            intent: nextBroll.reason || "B-roll footage",
            clipDescription: brollClip.description || "B-roll",
            isUserAsset: false,
            isBroll: true,
            kind: "video",
            inSec: 0,
            outSec: brollDuration,
            durationSec: brollDuration,
            cropMode: "cover",
            overlays: { title: null, subtitle: null, position: "lower_third", stylePreset: "minimal" },
            // NO TRANSITIONS for talking head - transitions shorten duration and break lip sync
            transitionOut: "none",
            transitionDuration: 0,
            // Track where in the source audio this corresponds to
            sourceAudioStart: sourceTime,
            sourceAudioEnd: sourceTime + brollDuration,
          });
        }
        
        sourceTime += brollDuration;
        brollIndex++;
        continue;
      } else {
        // No more B-roll - show talking head until the end
        segmentEnd = totalDuration;
      }
      
      // Add talking head segment
      if (segmentEnd > sourceTime) {
        const { video, asset, localTime } = getCurrentVideo(sourceTime);
        const duration = segmentEnd - sourceTime;
        
        if (asset) {
          scenes.push({
            id: `scene-th-${scenes.length}`,
            assetId: video.assetId,
            clipId: video.assetId,
            clipUrl: asset.public_url,
            intent: "Talking head",
            clipDescription: "User speaking",
            isUserAsset: true,
            isTalkingHead: true,
            kind: "video",
            inSec: localTime,
            outSec: localTime + duration,
            durationSec: duration,
            cropMode: "cover",
            overlays: { title: null, subtitle: null, position: "lower_third", stylePreset: "minimal" },
            // NO TRANSITIONS for talking head - transitions shorten duration and break lip sync
            transitionOut: "none",
            transitionDuration: 0,
          });
        }
        
        sourceTime = segmentEnd;
      }
    }
    
    console.log(`[Talking Head] Built ${scenes.length} scenes`);
    
    // Combine all captions and adjust timing
    let allCaptions: Array<{ start: number; end: number; text: string }> = [];
    let captionOffset = 0;
    
    for (const video of videos) {
      const offsetCaptions = video.captions.map(c => ({
        start: c.start + captionOffset,
        end: c.end + captionOffset,
        text: c.text,
      }));
      allCaptions = [...allCaptions, ...offsetCaptions];
      captionOffset += video.duration;
    }
    
    // Get music if selected, or auto-select first available track
    let musicData: any = null;
    console.log(`[Talking Head] Music settings: selectedMusicId=${settings.selectedMusicId}, musicVolume=${settings.musicVolume}`);
    
    if (settings.selectedMusicId) {
      const { data: music, error: musicError } = await adminSupabase
        .from("music")
        .select("*")
        .eq("id", settings.selectedMusicId)
        .single();
      
      if (musicError) {
        console.error(`[Talking Head] Failed to fetch music:`, musicError);
      }
      
      if (music) {
        const volume = VOLUME_MAP[settings.musicVolume] || 0.2;
        musicData = {
          assetId: music.id,
          audioUrl: music.audio_url,
          title: music.title,
          volume: volume,
        };
        console.log(`[Talking Head] Music found:`, {
          title: music.title,
          audioUrl: music.audio_url,
          audioUrlPresent: !!music.audio_url,
          volume: volume,
          musicVolumeSetting: settings.musicVolume,
        });
        
        // Warn if audio_url is missing
        if (!music.audio_url) {
          console.error(`[Talking Head] WARNING: Music track "${music.title}" has no audio_url!`);
        }
      } else {
        console.log(`[Talking Head] No music found for ID: ${settings.selectedMusicId}`);
      }
    } else {
      // No music selected - auto-select first available track with low volume
      console.log(`[Talking Head] No music selected, attempting to auto-select...`);
      const { data: allMusic, error: allMusicError } = await adminSupabase
        .from("music")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (allMusicError) {
        console.error(`[Talking Head] Failed to fetch music for auto-select:`, allMusicError);
      } else if (allMusic && allMusic.length > 0) {
        const music = allMusic[0];
        // Use faint volume (0.1) for auto-selected music so it doesn't overpower the speaker
        const volume = 0.1;
        musicData = {
          assetId: music.id,
          audioUrl: music.audio_url,
          title: music.title,
          volume: volume,
        };
        console.log(`[Talking Head] Auto-selected music:`, {
          title: music.title,
          audioUrl: music.audio_url,
          audioUrlPresent: !!music.audio_url,
          volume: volume,
        });
        
        if (!music.audio_url) {
          console.error(`[Talking Head] WARNING: Auto-selected music track "${music.title}" has no audio_url!`);
          musicData = null;
        }
      } else {
        console.log(`[Talking Head] No music tracks available in database`);
      }
    }
    
    // Build the timeline JSON
    const projectId = uuid();
    
    const timelineJson = {
      version: 1,
      project: {
        id: projectId,
        resolution: { width: 1920, height: 1080 },
        fps: 30,
      },
      scenes,
      soundEffects: [],
      imageOverlays: [],
      // Audio tracks - user video audio is PRIMARY (not voiceover)
      audioTracks: videos.map((v, i) => ({
        id: `audio-${i}`,
        assetId: v.assetId,
        type: "user_audio",
        startOffset: videos.slice(0, i).reduce((sum, vid) => sum + vid.duration, 0),
        volume: 1.0,
      })),
      global: {
        music: musicData || { assetId: null, audioUrl: null, volume: 0 },
        voiceover: { assetId: null, volume: 0, startOffset: 0 },
        captions: {
          enabled: settings.enableCaptions,
          burnIn: settings.enableCaptions,
          wordsPerBlock: settings.captionWordsPerBlock,
          font: settings.captionFont,
          srtAssetId: null,
          startOffset: 0,
          segments: settings.enableCaptions ? allCaptions : [],
        },
        brand: {
          presetId: null,
          logoAssetId: null,
          logoPosition: "top-right",
          logoSize: 80,
          colors: { primary: "#00b4d8", secondary: "#0077b6", accent: "#ff6b6b", text: "#ffffff" },
          safeMargins: { top: 50, bottom: 50, left: 50, right: 50 },
        },
        export: { codec: "h264", crf: 23, bitrateMbps: 8, audioKbps: 192 },
      },
      rendering: {
        output: { url: null, thumbnailUrl: null, durationSec: null, sizeBytes: null },
        voiceoverDurationSec: 0,
        totalDurationSec: totalDuration,
        introDurationSec: 0,
        outroDurationSec: 0,
        // Special flag for talking head videos - use user audio, not voiceover
        isTalkingHead: true,
        userAudioAssetIds: userAssetIds,
      },
    };
    
    // Create the project
    const { data: project, error: projectError } = await adminSupabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: title || "Talking Head Video",
        type: "talking_head",
        timeline_json: timelineJson,
        status: "draft",
        duration_sec: totalDuration,
        script: fullTranscript,
        description: `Talking head video with ${brollInsertions.length} B-roll cuts`,
      })
      .select()
      .single();
    
    if (projectError || !project) {
      console.error("Project creation error:", projectError);
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }
    
    console.log(`[Talking Head] Created project ${project.id}`);
    
    return NextResponse.json({
      success: true,
      projectId: project.id,
      timeline: timelineJson,
      totalDurationSec: totalDuration,
      sceneCount: scenes.length,
      brollCount: brollInsertions.length,
    });
    
  } catch (error) {
    console.error("[Talking Head] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to build timeline" 
    }, { status: 500 });
  }
}

