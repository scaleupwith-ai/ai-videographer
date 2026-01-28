import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Supabase admin client (bypasses RLS)
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  type: string;
  status: string;
  aspect_ratio: string;
  fps: number;
  resolution_w: number;
  resolution_h: number;
  timeline_json: TimelineV1 | null;
  output_url: string | null;
  thumbnail_url: string | null;
}

export interface MediaAsset {
  id: string;
  owner_id: string;
  object_key: string;
  public_url: string | null;
  kind: string;
  filename: string;
  duration_sec: number | null;
}

export interface RenderJob {
  id: string;
  project_id: string;
  status: string;
  progress: number;
  logs: string[];
  error: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
}

// Text overlay type
export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  style: {
    color: string;
    fontSize: number;
    fontFamily: string;
    duration: number;
  };
}

// Timeline types (simplified for worker)
export interface TimelineV1 {
  version: number;
  project: {
    id: string;
    title: string;
    type: string;
    aspectRatio: string;
    resolution: { width: number; height: number };
    fps: number;
  };
  scenes: Scene[];
  textOverlays?: TextOverlay[];
  global: {
    music: { assetId: string | null; audioUrl?: string | null; volume: number };
    voiceover: { assetId: string | null; volume: number; startOffset?: number };
    captions: { 
      enabled: boolean; 
      burnIn: boolean;
      font?: string;
      wordsPerBlock?: number;
      startOffset?: number;
      segments?: Array<{ start: number; end: number; text: string }>;
    };
    brand: {
      logoAssetId: string | null;
      logoPosition: string;
      logoSize: number;
      colors: { primary: string; text: string };
    };
    export: { codec: string; bitrateMbps: number; crf?: number; audioKbps: number };
  };
  soundEffects?: Array<{
    id: string;
    title: string;
    audioUrl: string;
    atTimeSec: number;
    volume: number;
  }>;
  imageOverlays?: Array<{
    id: string;
    title: string;
    imageUrl: string;
    atTimeSec: number;
    durationSec: number;
    x: number;
    y: number;
    scale: number;
    width: number | null;
    height: number | null;
  }>;
  rendering?: {
    output: { url: string | null; thumbnailUrl: string | null; durationSec: number | null; sizeBytes: number | null };
    voiceoverDurationSec?: number; // Store voiceover duration to prevent speech cutoff
    totalDurationSec?: number;
    introDurationSec?: number;
    outroDurationSec?: number;
    // Talking head specific
    isTalkingHead?: boolean;
    userAudioAssetIds?: string[]; // Asset IDs for user videos with audio
  };
  // Audio tracks for talking head videos
  audioTracks?: Array<{
    id: string;
    assetId: string;
    type: string;
    startOffset: number;
    volume: number;
  }>;
}

export interface Scene {
  id: string;
  assetId: string | null; // For user assets (media_assets table)
  clipId?: string; // For b-roll clips (clips table)
  clipUrl?: string; // Direct URL to video file (for b-roll)
  isUserAsset?: boolean;
  isTalkingHead?: boolean; // Scene shows user speaking
  isBroll?: boolean; // Scene is B-roll footage
  kind: string;
  inSec: number;
  outSec: number;
  durationSec: number;
  cropMode: string;
  overlays?: {
    text?: string | null;
    x?: number; // 0-100 percentage
    y?: number; // 0-100 percentage
    style?: {
      color: string;
      fontSize: number;
      fontFamily: string;
      duration: number;
    };
  };
  transitionOut?: string | null;
  transitionDuration?: number; // Duration of xfade transition in seconds
}

/**
 * Fetch project with timeline
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) {
    console.error("Error fetching project:", error);
    return null;
  }

  return data as Project;
}

/**
 * Fetch media assets by IDs
 */
export async function getAssets(assetIds: string[]): Promise<Map<string, MediaAsset>> {
  if (assetIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .in("id", assetIds);

  if (error) {
    console.error("Error fetching assets:", error);
    return new Map();
  }

  const map = new Map<string, MediaAsset>();
  (data || []).forEach((asset) => map.set(asset.id, asset as MediaAsset));
  return map;
}

/**
 * Update render job progress
 */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  log?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    progress,
    updated_at: new Date().toISOString(),
  };

  if (log) {
    // Append log entry
    const { data: job } = await supabase
      .from("render_jobs")
      .select("logs")
      .eq("id", jobId)
      .single();

    const logs = job?.logs || [];
    logs.push(`[${new Date().toISOString()}] ${log}`);
    updates.logs = logs;
  }

  await supabase.from("render_jobs").update(updates).eq("id", jobId);
}

/**
 * Update render job status
 */
export async function updateJobStatus(
  jobId: string,
  status: "running" | "finished" | "failed",
  data?: {
    error?: string;
    outputUrl?: string;
    thumbnailUrl?: string;
    durationSec?: number;
    sizeBytes?: number;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "running") {
    updates.started_at = new Date().toISOString();
  } else if (status === "finished" || status === "failed") {
    updates.finished_at = new Date().toISOString();
    if (status === "finished") {
      updates.progress = 100;
    }
  }

  if (data?.error) updates.error = data.error;
  if (data?.outputUrl) updates.output_url = data.outputUrl;
  if (data?.thumbnailUrl) updates.thumbnail_url = data.thumbnailUrl;
  if (data?.durationSec) updates.duration_sec = data.durationSec;
  if (data?.sizeBytes) updates.size_bytes = data.sizeBytes;

  await supabase.from("render_jobs").update(updates).eq("id", jobId);
}

/**
 * Update project with render output
 */
export async function updateProjectOutput(
  projectId: string,
  status: "finished" | "failed",
  data?: {
    outputUrl?: string;
    thumbnailUrl?: string;
    durationSec?: number;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (data?.outputUrl) updates.output_url = data.outputUrl;
  if (data?.thumbnailUrl) updates.thumbnail_url = data.thumbnailUrl;
  if (data?.durationSec) updates.duration_sec = data.durationSec;

  await supabase.from("projects").update(updates).eq("id", projectId);
}

/**
 * Get queued render jobs from database (for polling when Redis is unavailable)
 */
export async function getQueuedJobs(limit: number = 1): Promise<{ id: string; project_id: string }[]> {
  const { data, error } = await supabase
    .from("render_jobs")
    .select("id, project_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching queued jobs:", error);
    return [];
  }

  return data || [];
}

