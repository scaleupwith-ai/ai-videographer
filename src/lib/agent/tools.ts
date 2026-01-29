/**
 * AI Video Agent Tools
 * 
 * These tools are available to the AI agent for building video timelines.
 * Uses OpenAI function calling format for tool definitions.
 */

import { createClient } from "@supabase/supabase-js";
import { getEffectsForAI, createEffectFromAI, getEffectById } from "@/lib/effects/templates";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// TOOL DEFINITIONS (OpenAI Function Calling Format)
// ============================================================================

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_clips",
      description: "Search for video clips that match a description. Returns a list of clips with their IDs, durations, and descriptions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query describing the type of video clip needed (e.g., 'people working in office', 'nature scenery', 'product closeup')"
          },
          duration_min: {
            type: "number",
            description: "Minimum clip duration in seconds (optional)"
          },
          duration_max: {
            type: "number",
            description: "Maximum clip duration in seconds (optional)"
          },
          limit: {
            type: "number",
            description: "Maximum number of clips to return (default: 10)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_music",
      description: "Search for background music tracks. Returns a list of music with IDs, titles, moods, and durations.",
      parameters: {
        type: "object",
        properties: {
          mood: {
            type: "string",
            description: "Mood of the music (e.g., 'uplifting', 'calm', 'energetic', 'corporate')"
          },
          limit: {
            type: "number",
            description: "Maximum number of tracks to return (default: 5)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_sound_effects",
      description: "Search for sound effects. Returns a list of SFX with IDs, titles, and descriptions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for sound effect (e.g., 'whoosh', 'click', 'notification', 'success')"
          },
          limit: {
            type: "number",
            description: "Maximum number of SFX to return (default: 5)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "add_effect",
      description: "Add a visual effect/overlay to the video at a specific time. Effects include lower thirds, slide-in boxes, letterbox bars, corner accents, and border glow.",
      parameters: {
        type: "object",
        properties: {
          effect_id: {
            type: "string",
            enum: ["lower-third-minimal", "slide-box-left", "slide-box-right", "letterbox-with-text", "corner-accents", "border-glow"],
            description: "ID of the effect to use"
          },
          start_time: {
            type: "number",
            description: "When the effect should appear (in seconds from video start)"
          },
          header_text: {
            type: "string",
            description: "Header/title text for the effect (for lower thirds and slide-in boxes)"
          },
          body_text: {
            type: "string",
            description: "Body/subtitle text for the effect"
          },
          top_text: {
            type: "string",
            description: "Text for top bar (letterbox effect only)"
          },
          bottom_text: {
            type: "string",
            description: "Text for bottom bar (letterbox effect only)"
          }
        },
        required: ["effect_id", "start_time"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_available_effects",
      description: "Get a list of all available visual effects with their descriptions and when to use them.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function executeSearchClips(params: {
  query: string;
  duration_min?: number;
  duration_max?: number;
  limit?: number;
}): Promise<string> {
  const supabase = getAdminSupabase();
  const limit = params.limit || 10;
  
  try {
    // First try text search
    let query = supabase
      .from("clips")
      .select("id, title, description, duration_seconds, resolution, tags, video_url")
      .limit(limit);
    
    // Add duration filters if provided
    if (params.duration_min) {
      query = query.gte("duration_seconds", params.duration_min);
    }
    if (params.duration_max) {
      query = query.lte("duration_seconds", params.duration_max);
    }
    
    // Text search
    query = query.or(`title.ilike.%${params.query}%,description.ilike.%${params.query}%`);
    
    const { data: clips, error } = await query;
    
    if (error) throw error;
    
    if (!clips || clips.length === 0) {
      return JSON.stringify({
        success: true,
        clips: [],
        message: "No clips found matching the query. Try a different search term."
      });
    }
    
    const formattedClips = clips.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description?.slice(0, 100),
      duration: c.duration_seconds,
      resolution: c.resolution,
      tags: c.tags,
    }));
    
    return JSON.stringify({
      success: true,
      clips: formattedClips,
      count: clips.length
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Failed to search clips"
    });
  }
}

export async function executeSearchMusic(params: {
  mood?: string;
  limit?: number;
}): Promise<string> {
  const supabase = getAdminSupabase();
  const limit = params.limit || 5;
  
  try {
    let query = supabase
      .from("music")
      .select("id, title, artist, duration_seconds, mood, tags, audio_url")
      .limit(limit);
    
    if (params.mood) {
      query = query.contains("mood", [params.mood]);
    }
    
    const { data: music, error } = await query;
    
    if (error) throw error;
    
    const formattedMusic = (music || []).map(m => ({
      id: m.id,
      title: m.title,
      artist: m.artist,
      duration: m.duration_seconds,
      mood: m.mood,
      tags: m.tags,
    }));
    
    return JSON.stringify({
      success: true,
      tracks: formattedMusic,
      count: formattedMusic.length
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Failed to search music"
    });
  }
}

export async function executeSearchSoundEffects(params: {
  query: string;
  limit?: number;
}): Promise<string> {
  const supabase = getAdminSupabase();
  const limit = params.limit || 5;
  
  try {
    const { data: sfx, error } = await supabase
      .from("sound_effects")
      .select("id, title, description, duration_seconds, tags, audio_url")
      .or(`title.ilike.%${params.query}%,description.ilike.%${params.query}%,tags.cs.{${params.query}}`)
      .limit(limit);
    
    if (error) throw error;
    
    const formattedSfx = (sfx || []).map(s => ({
      id: s.id,
      title: s.title,
      description: s.description?.slice(0, 100),
      duration: s.duration_seconds,
      tags: s.tags,
    }));
    
    return JSON.stringify({
      success: true,
      effects: formattedSfx,
      count: formattedSfx.length
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Failed to search sound effects"
    });
  }
}

export function executeAddEffect(
  params: {
    effect_id: string;
    start_time: number;
    header_text?: string;
    body_text?: string;
    top_text?: string;
    bottom_text?: string;
  },
  brandColors: { primary: string; secondary: string; accent: string }
): string {
  const effect = getEffectById(params.effect_id);
  
  if (!effect) {
    return JSON.stringify({
      success: false,
      error: `Unknown effect: ${params.effect_id}. Use get_available_effects to see available effects.`
    });
  }
  
  // Calculate minimum duration based on text length (0.4 seconds per word - fast but readable)
  const SECONDS_PER_WORD = 0.4;
  let textWordCount = 0;
  if (params.header_text) textWordCount += params.header_text.split(/\s+/).length;
  if (params.body_text) textWordCount += params.body_text.split(/\s+/).length;
  if (params.top_text) textWordCount += params.top_text.split(/\s+/).length;
  if (params.bottom_text) textWordCount += params.bottom_text.split(/\s+/).length;
  
  const minDuration = Math.max(2, textWordCount * SECONDS_PER_WORD); // At least 2 seconds
  
  const config = createEffectFromAI(
    params.effect_id,
    {
      header: params.header_text,
      body: params.body_text,
      topText: params.top_text,
      bottomText: params.bottom_text,
    },
    brandColors
  );
  
  if (!config) {
    return JSON.stringify({
      success: false,
      error: "Failed to create effect configuration"
    });
  }
  
  // Override timing to ensure text is readable
  config.slideIn = effect.defaultTiming.slideIn;
  config.hold = Math.max(effect.defaultTiming.hold, minDuration - effect.defaultTiming.slideIn - effect.defaultTiming.slideOut);
  config.slideOut = effect.defaultTiming.slideOut;
  
  const totalDuration = (config.slideIn as number) + (config.hold as number) + (config.slideOut as number);
  
  return JSON.stringify({
    success: true,
    effect: {
      id: params.effect_id,
      name: effect.name,
      startTime: params.start_time,
      duration: totalDuration,
      config,
    },
    message: `Added "${effect.name}" at ${params.start_time}s for ${totalDuration}s (${textWordCount} words @ ${SECONDS_PER_WORD}s/word)`
  });
}

export function executeGetAvailableEffects(): string {
  const effects = getEffectsForAI();
  
  return JSON.stringify({
    success: true,
    effects: effects.map(e => ({
      id: e.id,
      name: e.name,
      usage: e.usage,
      textFields: e.textFields,
      defaultDuration: e.defaultDuration,
    })),
    timing_rule: "Effects with text should be at least 2 seconds per word to ensure readability."
  });
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  brandColors: { primary: string; secondary: string; accent: string }
): Promise<string> {
  console.log(`[Agent Tool] Executing: ${toolName}`, params);
  
  switch (toolName) {
    case "search_clips":
      return executeSearchClips(params as Parameters<typeof executeSearchClips>[0]);
    case "search_music":
      return executeSearchMusic(params as Parameters<typeof executeSearchMusic>[0]);
    case "search_sound_effects":
      return executeSearchSoundEffects(params as Parameters<typeof executeSearchSoundEffects>[0]);
    case "add_effect":
      return executeAddEffect(params as Parameters<typeof executeAddEffect>[0], brandColors);
    case "get_available_effects":
      return executeGetAvailableEffects();
    default:
      return JSON.stringify({
        success: false,
        error: `Unknown tool: ${toolName}`
      });
  }
}

