import { z } from "zod";

// ============================================
// Timeline JSON Spec v1
// Single source of truth for video project structure
// ============================================

// ============================================
// PRESET DEFINITIONS - Template System
// Maps to FFmpeg filtergraph at render time
// ============================================

// Simplified transition presets for user selection
export const TransitionPresets = [
  "cut",      // No transition, hard cut
  "fade",     // Cross-dissolve fade
  "slide",    // Slide left/right
  "wipe",     // Wipe transition
] as const;

export const TransitionPresetSchema = z.enum(TransitionPresets);
export type TransitionPreset = z.infer<typeof TransitionPresetSchema>;

// Map transition presets to FFmpeg xfade types
export const transitionPresetToFFmpeg: Record<TransitionPreset, string | null> = {
  cut: null,           // No xfade, just concatenate
  fade: "fade",        // xfade=fade
  slide: "slideleft",  // xfade=slideleft
  wipe: "wipeleft",    // xfade=wipeleft
};

// Clip animation presets - applied during render
export const AnimationPresets = [
  "none",           // Static clip, no animation
  "subtle_zoom",    // Slow zoom in (Ken Burns light)
  "pan_left",       // Pan from right to left
  "pan_right",      // Pan from left to right
  "punch_in",       // Quick zoom punch effect
] as const;

export const AnimationPresetSchema = z.enum(AnimationPresets);
export type AnimationPreset = z.infer<typeof AnimationPresetSchema>;

// Text style presets for overlays
export const TextStylePresets = [
  "lower_third",    // Classic lower-third bar
  "headline",       // Large centered headline
  "captions",       // Subtitle-style captions
  "minimal",        // Simple text, no background
] as const;

export const TextStylePresetSchema = z.enum(TextStylePresets);
export type TextStylePreset = z.infer<typeof TextStylePresetSchema>;

// Scene overlay configuration (legacy, kept for backward compatibility)
export const OverlaySchema = z.object({
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  position: z.enum(["center", "top", "bottom", "lower_third", "upper_third"]).default("lower_third"),
  stylePreset: z.enum(["boxed", "lower_third", "minimal"]).default("lower_third"),
});

// Text overlay item with timing and position
export const TextOverlaySchema = z.object({
  id: z.string(),
  text: z.string(),
  x: z.number().min(0).max(100).default(50),  // Percentage from left
  y: z.number().min(0).max(100).default(80),  // Percentage from top
  startTime: z.number().min(0).default(0),    // Start time in seconds
  duration: z.number().min(0).default(0),      // Duration (0 = entire video)
  style: TextStylePresetSchema.default("lower_third"),
  // Custom style overrides
  color: z.string().default("#ffffff"),
  fontSize: z.number().min(12).max(200).default(48),
  fontFamily: z.string().default("Inter"),
  animation: z.enum(["none", "fade_in", "slide_up", "typewriter"]).default("fade_in"),
});

export type TextOverlay = z.infer<typeof TextOverlaySchema>;

// FFmpeg xfade transitions (full list for internal use)
export const TransitionTypes = [
  "none",
  "fade",
  "fadeblack",
  "fadewhite",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "circlecrop",
  "circleopen",
  "circleclose",
  "dissolve",
  "pixelize",
  "radial",
  "smoothleft",
  "smoothright",
  "smoothup",
  "smoothdown",
] as const;

export const TransitionSchema = z.enum(TransitionTypes);

// Individual scene in the timeline
export const SceneSchema = z.object({
  id: z.string(),
  assetId: z.string().nullable(), // Reference to media_assets.id
  clipId: z.string().nullable().optional(), // Reference to clips.id (for b-roll)
  clipUrl: z.string().nullable().optional(), // Direct URL to video file
  isUserAsset: z.boolean().optional(), // Whether this is a user-uploaded asset
  kind: z.enum(["video", "image"]),
  inSec: z.number().min(0).default(0), // Trim start point
  outSec: z.number().min(0), // Trim end point
  durationSec: z.number().min(0), // Computed: outSec - inSec
  cropMode: z.enum(["cover", "contain", "fill"]).default("cover"),
  overlays: OverlaySchema.optional(),
  
  // Transition preset (simplified for user selection)
  transition: TransitionPresetSchema.nullable().optional(),
  // Legacy: FFmpeg xfade transition type (internal use)
  transitionOut: TransitionSchema.nullable().optional(),
  transitionDuration: z.number().min(0).max(2).default(0.5).optional(),
  
  // Animation preset for the clip
  animation: AnimationPresetSchema.default("none").optional(),
  
  // Scene intent/description (for AI context)
  intent: z.string().nullable().optional(),
  clipDescription: z.string().nullable().optional(),
});

// Music track configuration
export const MusicSchema = z.object({
  assetId: z.string().nullable(),
  volume: z.number().min(0).max(1).default(0.3),
});

// Voiceover configuration
export const VoiceoverSchema = z.object({
  assetId: z.string().nullable(),
  volume: z.number().min(0).max(1).default(1.0),
});

// Single caption segment with timing
export const CaptionSegmentSchema = z.object({
  start: z.number(), // Start time in seconds
  end: z.number(),   // End time in seconds  
  text: z.string(),  // Caption text
});

// Captions configuration
export const CaptionsSchema = z.object({
  enabled: z.boolean().default(false),
  burnIn: z.boolean().default(false), // Burn into video vs separate SRT
  srtAssetId: z.string().nullable().optional(),
  wordsPerBlock: z.number().default(3).optional(),
  font: z.string().default("Inter").optional(),
  startOffset: z.number().default(0).optional(), // Offset for intro
  segments: z.array(CaptionSegmentSchema).optional(), // Timed caption segments
});

// Brand configuration for this project
export const BrandSchema = z.object({
  presetId: z.string().nullable().optional(),
  logoAssetId: z.string().nullable().optional(),
  logoPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).default("top-right"),
  logoSize: z.number().min(20).max(200).default(80), // pixels
  colors: z.object({
    primary: z.string().default("#00b4d8"),
    secondary: z.string().default("#0077b6"),
    accent: z.string().default("#ff6b6b"),
    text: z.string().default("#ffffff"),
  }),
  safeMargins: z.object({
    top: z.number().default(50),
    bottom: z.number().default(50),
    left: z.number().default(50),
    right: z.number().default(50),
  }),
});

// Export settings
export const ExportSchema = z.object({
  codec: z.enum(["h264", "h265"]).default("h264"),
  bitrateMbps: z.number().min(1).max(50).default(10),
  crf: z.number().min(0).max(51).optional(), // If set, overrides bitrate
  audioKbps: z.number().min(64).max(320).default(192),
});

// Rendering output (populated after render completes)
export const RenderingOutputSchema = z.object({
  url: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  durationSec: z.number().nullable(),
  sizeBytes: z.number().nullable(),
});

// Project metadata
export const ProjectMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(), // product_promo, real_estate, etc.
  aspectRatio: z.enum(["landscape", "vertical", "square"]),
  resolution: z.object({
    width: z.number().default(1920),
    height: z.number().default(1080),
  }),
  fps: z.number().default(30),
});

// Global settings
export const GlobalSchema = z.object({
  music: MusicSchema,
  voiceover: VoiceoverSchema,
  captions: CaptionsSchema,
  brand: BrandSchema,
  export: ExportSchema,
});

// Complete Timeline JSON v1 schema
export const TimelineV1Schema = z.object({
  version: z.literal(1),
  project: ProjectMetaSchema,
  scenes: z.array(SceneSchema),
  textOverlays: z.array(TextOverlaySchema).optional(), // Global text overlays with timing
  global: GlobalSchema,
  rendering: z.object({
    output: RenderingOutputSchema,
    // Additional rendering metadata
    voiceoverDurationSec: z.number().optional(),
    totalDurationSec: z.number().optional(),
    introDurationSec: z.number().optional(),
    outroDurationSec: z.number().optional(),
  }),
  // Sound effects with timing
  soundEffects: z.array(z.object({
    id: z.string(),
    title: z.string(),
    audioUrl: z.string(),
    atTimeSec: z.number(),
    volume: z.number().min(0).max(1).default(0.5),
  })).optional(),
  // Image overlays with timing
  imageOverlays: z.array(z.object({
    id: z.string(),
    title: z.string(),
    imageUrl: z.string(),
    atTimeSec: z.number(),
    durationSec: z.number(),
    x: z.number().default(50),
    y: z.number().default(50),
    scale: z.number().default(1),
    width: z.number().nullable(),
    height: z.number().nullable(),
  })).optional(),
});

// TypeScript types derived from Zod schemas
export type Overlay = z.infer<typeof OverlaySchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Music = z.infer<typeof MusicSchema>;
export type Voiceover = z.infer<typeof VoiceoverSchema>;
export type Captions = z.infer<typeof CaptionsSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type Export = z.infer<typeof ExportSchema>;
export type RenderingOutput = z.infer<typeof RenderingOutputSchema>;
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
export type Global = z.infer<typeof GlobalSchema>;
export type TimelineV1 = z.infer<typeof TimelineV1Schema>;

// Re-export preset types for convenience
export { TransitionPreset, AnimationPreset, TextStylePreset };

// ============================================
// Timeline Utilities
// ============================================

/**
 * Create an empty timeline with default values
 */
export function createEmptyTimeline(params: {
  id: string;
  title: string;
  type: string;
  aspectRatio: "landscape" | "vertical" | "square";
}): TimelineV1 {
  const resolutions = {
    landscape: { width: 1920, height: 1080 },
    vertical: { width: 1080, height: 1920 },
    square: { width: 1080, height: 1080 },
  };

  return {
    version: 1,
    project: {
      id: params.id,
      title: params.title,
      type: params.type,
      aspectRatio: params.aspectRatio,
      resolution: resolutions[params.aspectRatio],
      fps: 30,
    },
    scenes: [],
    global: {
      music: { assetId: null, volume: 0.3 },
      voiceover: { assetId: null, volume: 1.0 },
      captions: { enabled: false, burnIn: false, srtAssetId: null },
      brand: {
        presetId: null,
        logoAssetId: null,
        logoPosition: "top-right",
        logoSize: 80,
        colors: {
          primary: "#00b4d8",
          secondary: "#0077b6",
          accent: "#ff6b6b",
          text: "#ffffff",
        },
        safeMargins: { top: 50, bottom: 50, left: 50, right: 50 },
      },
      export: { codec: "h264", bitrateMbps: 10, crf: 23, audioKbps: 192 },
    },
    rendering: {
      output: { url: null, thumbnailUrl: null, durationSec: null, sizeBytes: null },
    },
  };
}

/**
 * Create a new scene with default values
 */
export function createScene(params: {
  id: string;
  assetId: string | null;
  clipId?: string | null;
  clipUrl?: string | null;
  kind: "video" | "image";
  durationSec: number;
  intent?: string;
  clipDescription?: string;
}): Scene {
  return {
    id: params.id,
    assetId: params.assetId,
    clipId: params.clipId ?? null,
    clipUrl: params.clipUrl ?? null,
    kind: params.kind,
    inSec: 0,
    outSec: params.durationSec,
    durationSec: params.durationSec,
    cropMode: "cover",
    overlays: {
      title: null,
      subtitle: null,
      position: "lower_third",
      stylePreset: "lower_third",
    },
    transition: "cut",
    transitionOut: null,
    transitionDuration: 0.5,
    animation: "none",
    intent: params.intent ?? null,
    clipDescription: params.clipDescription ?? null,
  };
}

/**
 * Create a new text overlay with default values
 */
export function createTextOverlay(params: {
  id: string;
  text: string;
  startTime: number;
  duration?: number;
  style?: TextStylePreset;
}): TextOverlay {
  return {
    id: params.id,
    text: params.text,
    x: 50,
    y: 80,
    startTime: params.startTime,
    duration: params.duration ?? 3,
    style: params.style ?? "lower_third",
    color: "#ffffff",
    fontSize: 48,
    fontFamily: "Inter",
    animation: "fade_in",
  };
}

/**
 * Compute scene duration from in/out points
 */
export function computeSceneDuration(scene: Scene): number {
  return Math.max(0, scene.outSec - scene.inSec);
}

/**
 * Normalize a scene (ensure durationSec matches outSec - inSec)
 */
export function normalizeScene(scene: Scene): Scene {
  return {
    ...scene,
    durationSec: computeSceneDuration(scene),
  };
}

/**
 * Normalize all scenes in a timeline
 */
export function normalizeTimeline(timeline: TimelineV1): TimelineV1 {
  return {
    ...timeline,
    scenes: timeline.scenes.map(normalizeScene),
  };
}

/**
 * Calculate total duration of all scenes
 */
export function totalDurationSec(timeline: TimelineV1): number {
  return timeline.scenes.reduce((sum, scene) => sum + computeSceneDuration(scene), 0);
}

/**
 * Get scene start times (cumulative)
 */
export function getSceneStartTimes(timeline: TimelineV1): Map<string, number> {
  const startTimes = new Map<string, number>();
  let currentTime = 0;

  for (const scene of timeline.scenes) {
    startTimes.set(scene.id, currentTime);
    currentTime += computeSceneDuration(scene);
  }

  return startTimes;
}

/**
 * Find scene at a given time
 */
export function findSceneAtTime(timeline: TimelineV1, timeSec: number): Scene | null {
  let currentTime = 0;

  for (const scene of timeline.scenes) {
    const duration = computeSceneDuration(scene);
    if (timeSec >= currentTime && timeSec < currentTime + duration) {
      return scene;
    }
    currentTime += duration;
  }

  return null;
}

/**
 * Validate a timeline against the schema
 */
export function validateTimeline(data: unknown): { success: true; data: TimelineV1 } | { success: false; error: z.ZodError } {
  const result = TimelineV1Schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Reorder scenes by moving a scene from one index to another
 */
export function reorderScenes(timeline: TimelineV1, fromIndex: number, toIndex: number): TimelineV1 {
  const scenes = [...timeline.scenes];
  const [removed] = scenes.splice(fromIndex, 1);
  scenes.splice(toIndex, 0, removed);
  return { ...timeline, scenes };
}

/**
 * Update a specific scene in the timeline
 */
export function updateScene(timeline: TimelineV1, sceneId: string, updates: Partial<Scene>): TimelineV1 {
  return {
    ...timeline,
    scenes: timeline.scenes.map((scene) =>
      scene.id === sceneId ? normalizeScene({ ...scene, ...updates }) : scene
    ),
  };
}

/**
 * Delete a scene from the timeline
 */
export function deleteScene(timeline: TimelineV1, sceneId: string): TimelineV1 {
  return {
    ...timeline,
    scenes: timeline.scenes.filter((scene) => scene.id !== sceneId),
  };
}

/**
 * Add a scene to the timeline
 */
export function addScene(timeline: TimelineV1, scene: Scene, index?: number): TimelineV1 {
  const scenes = [...timeline.scenes];
  if (index !== undefined && index >= 0 && index <= scenes.length) {
    scenes.splice(index, 0, normalizeScene(scene));
  } else {
    scenes.push(normalizeScene(scene));
  }
  return { ...timeline, scenes };
}

