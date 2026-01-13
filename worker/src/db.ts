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
  storage_key: string;
  url: string;
  asset_type: string;
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
  global: {
    music: { assetId: string | null; volume: number };
    voiceover: { assetId: string | null; volume: number };
    captions: { enabled: boolean; burnIn: boolean };
    brand: {
      logoAssetId: string | null;
      logoPosition: string;
      logoSize: number;
      colors: { primary: string; text: string };
    };
    export: { codec: string; bitrateMbps: number; crf?: number; audioKbps: number };
  };
}

export interface Scene {
  id: string;
  assetId: string | null;
  kind: string;
  inSec: number;
  outSec: number;
  durationSec: number;
  cropMode: string;
  overlays?: {
    title?: string | null;
    subtitle?: string | null;
    position?: string;
    stylePreset?: string;
  };
  transitionOut?: string | null;
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

