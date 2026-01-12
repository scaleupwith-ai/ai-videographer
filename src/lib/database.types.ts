// Database types for Supabase
// Generated from schema - keep in sync with migrations

export type ProjectStatus = "draft" | "rendering" | "finished" | "failed";
export type AspectRatio = "landscape" | "vertical" | "square";
export type AssetKind = "video" | "image" | "audio" | "srt" | "logo";
export type OverlayStyle = "boxed" | "lower_third" | "minimal";
export type RenderJobStatus = "queued" | "running" | "finished" | "failed";

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  type: string;
  status: ProjectStatus;
  aspect_ratio: AspectRatio;
  fps: number;
  resolution_w: number;
  resolution_h: number;
  timeline_json: TimelineV1 | null;
  brand_preset_id: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  owner_id: string;
  bucket: string;
  object_key: string;
  public_url: string | null;
  kind: AssetKind;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BrandPreset {
  id: string;
  owner_id: string;
  name: string;
  logo_asset_id: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  safe_margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  overlay_style: OverlayStyle;
  created_at: string;
  updated_at: string;
}

export interface RenderJob {
  id: string;
  project_id: string;
  status: RenderJobStatus;
  progress: number;
  logs: string[];
  error: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  size_bytes: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

// Timeline JSON v1 type (imported from timeline module)
import type { TimelineV1 } from "./timeline/v1";
export type { TimelineV1 };

// Database table types for Supabase client
export interface Database {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Project, "id" | "created_at">>;
      };
      media_assets: {
        Row: MediaAsset;
        Insert: Omit<MediaAsset, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<MediaAsset, "id" | "created_at">>;
      };
      brand_presets: {
        Row: BrandPreset;
        Insert: Omit<BrandPreset, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<BrandPreset, "id" | "created_at">>;
      };
      render_jobs: {
        Row: RenderJob;
        Insert: Omit<RenderJob, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<RenderJob, "id" | "created_at">>;
      };
    };
  };
}

