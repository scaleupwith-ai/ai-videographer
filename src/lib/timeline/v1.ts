import { z } from "zod";

// ============================================
// Timeline JSON Spec v1
// Single source of truth for video project structure
// ============================================

// Scene overlay configuration
export const OverlaySchema = z.object({
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  position: z.enum(["center", "top", "bottom", "lower_third", "upper_third"]).default("lower_third"),
  stylePreset: z.enum(["boxed", "lower_third", "minimal"]).default("lower_third"),
});

// Individual scene in the timeline
export const SceneSchema = z.object({
  id: z.string(),
  assetId: z.string().nullable(), // Reference to media_assets.id
  kind: z.enum(["video", "image"]),
  inSec: z.number().min(0).default(0), // Trim start point
  outSec: z.number().min(0), // Trim end point
  durationSec: z.number().min(0), // Computed: outSec - inSec
  cropMode: z.enum(["cover", "contain", "fill"]).default("cover"),
  overlays: OverlaySchema.optional(),
  transitionOut: z.enum(["none", "crossfade", "fade_black"]).nullable().optional(),
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

// Captions configuration
export const CaptionsSchema = z.object({
  enabled: z.boolean().default(false),
  burnIn: z.boolean().default(false), // Burn into video vs separate SRT
  srtAssetId: z.string().nullable().optional(),
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
  global: GlobalSchema,
  rendering: z.object({
    output: RenderingOutputSchema,
  }),
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
  kind: "video" | "image";
  durationSec: number;
}): Scene {
  return {
    id: params.id,
    assetId: params.assetId,
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
    transitionOut: null,
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

