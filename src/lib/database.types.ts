export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          type: string
          aspect_ratio: 'landscape' | 'vertical' | 'square'
          fps: number
          resolution_w: number
          resolution_h: number
          duration_sec: number | null
          script: string | null
          timeline_json: Json | null
          status: 'draft' | 'rendering' | 'finished' | 'failed'
          thumbnail_url: string | null
          output_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description?: string | null
          type?: string
          aspect_ratio?: 'landscape' | 'vertical' | 'square'
          fps?: number
          resolution_w?: number
          resolution_h?: number
          duration_sec?: number | null
          script?: string | null
          timeline_json?: Json | null
          status?: 'draft' | 'rendering' | 'finished' | 'failed'
          thumbnail_url?: string | null
          output_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          description?: string | null
          type?: string
          aspect_ratio?: 'landscape' | 'vertical' | 'square'
          fps?: number
          resolution_w?: number
          resolution_h?: number
          duration_sec?: number | null
          script?: string | null
          timeline_json?: Json | null
          status?: 'draft' | 'rendering' | 'finished' | 'failed'
          thumbnail_url?: string | null
          output_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      media_assets: {
        Row: {
          id: string
          owner_id: string
          bucket: string
          object_key: string
          public_url: string | null
          kind: 'video' | 'image' | 'audio' | 'srt' | 'logo'
          filename: string
          mime_type: string
          size_bytes: number | null
          duration_sec: number | null
          width: number | null
          height: number | null
          thumbnail_url: string | null
          tags: string[]
          metadata: Record<string, unknown>
          status: 'processing' | 'ready' | 'failed'
          reference: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          bucket?: string
          object_key: string
          public_url?: string | null
          kind: 'video' | 'image' | 'audio' | 'srt' | 'logo'
          filename: string
          mime_type: string
          size_bytes?: number | null
          duration_sec?: number | null
          width?: number | null
          height?: number | null
          thumbnail_url?: string | null
          tags?: string[]
          metadata?: Record<string, unknown>
          status?: 'processing' | 'ready' | 'failed'
          reference?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          bucket?: string
          object_key?: string
          public_url?: string | null
          kind?: 'video' | 'image' | 'audio' | 'srt' | 'logo'
          filename?: string
          mime_type?: string
          size_bytes?: number | null
          duration_sec?: number | null
          width?: number | null
          height?: number | null
          thumbnail_url?: string | null
          tags?: string[]
          metadata?: Record<string, unknown>
          status?: 'processing' | 'ready' | 'failed'
          reference?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      brand_presets: {
        Row: {
          id: string
          owner_id: string
          name: string
          logo_asset_id: string | null
          primary_color: string
          secondary_color: string
          font_family: string
          logo_position: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          logo_asset_id?: string | null
          primary_color?: string
          secondary_color?: string
          font_family?: string
          logo_position?: string
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          logo_asset_id?: string | null
          primary_color?: string
          secondary_color?: string
          font_family?: string
          logo_position?: string
          is_default?: boolean
          created_at?: string
        }
      }
      render_jobs: {
        Row: {
          id: string
          project_id: string
          status: 'queued' | 'processing' | 'completed' | 'failed'
          progress: number
          output_url: string | null
          error: string | null
          logs: Json | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          progress?: number
          output_url?: string | null
          error?: string | null
          logs?: Json | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          progress?: number
          output_url?: string | null
          error?: string | null
          logs?: Json | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      clips: {
        Row: {
          id: string
          clip_link: string
          duration_seconds: number
          description: string | null
          tags: string[]
          thumbnail_url: string | null
          resolution: string
          width: number | null
          height: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clip_link: string
          duration_seconds: number
          description?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          resolution?: string
          width?: number | null
          height?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clip_link?: string
          duration_seconds?: number
          description?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          resolution?: string
          width?: number | null
          height?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      clip_variants: {
        Row: {
          id: string
          clip_id: string
          resolution: string
          width: number
          height: number
          clip_link: string
          size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          resolution: string
          width: number
          height: number
          clip_link: string
          size_bytes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          resolution?: string
          width?: number
          height?: number
          clip_link?: string
          size_bytes?: number | null
          created_at?: string
        }
      }
      video_jobs: {
        Row: {
          id: string
          user_id: string
          asset_url: string
          filename: string | null
          content_type: string | null
          duration: number | null
          status: 'queued' | 'processing' | 'done' | 'failed'
          progress: number
          provider_task_id: string | null
          result_json: Json | null
          error: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          asset_url: string
          filename?: string | null
          content_type?: string | null
          duration?: number | null
          status?: 'queued' | 'processing' | 'done' | 'failed'
          progress?: number
          provider_task_id?: string | null
          result_json?: Json | null
          error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          asset_url?: string
          filename?: string | null
          content_type?: string | null
          duration?: number | null
          status?: 'queued' | 'processing' | 'done' | 'failed'
          progress?: number
          provider_task_id?: string | null
          result_json?: Json | null
          error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      search_clips: {
        Args: {
          search_query?: string | null
          tag_filter?: string[] | null
          result_limit?: number
        }
        Returns: Database['public']['Tables']['clips']['Row'][]
      }
      search_clips_by_resolution: {
        Args: {
          search_query?: string | null
          tag_filter?: string[] | null
          target_resolution?: string
          result_limit?: number
        }
        Returns: {
          id: string
          clip_link: string
          duration_seconds: number
          description: string | null
          tags: string[]
          thumbnail_url: string | null
          resolution: string
          width: number | null
          height: number | null
        }[]
      }
    }
  }
}

export type Project = Database['public']['Tables']['projects']['Row']
export type MediaAsset = Database['public']['Tables']['media_assets']['Row']
export type BrandPreset = Database['public']['Tables']['brand_presets']['Row']
export type RenderJob = Database['public']['Tables']['render_jobs']['Row']
export type Clip = Database['public']['Tables']['clips']['Row']
export type ClipVariant = Database['public']['Tables']['clip_variants']['Row']
export type VideoJob = Database['public']['Tables']['video_jobs']['Row']

// User profile type (from user_profiles table)
export interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  phone_country_code: string | null
  business_name: string | null
  business_logo_url: string | null
  business_description: string | null
  business_size: 'solo' | '2-10' | '11-50' | '51-200' | '200+' | 'no_business' | null
  default_video_quality: '720p' | '1080p' | '4k'
  referral_source: string | null
  credits: number
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

// Payment history type
export interface PaymentHistory {
  id: string
  user_id: string
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  amount_cents: number
  currency: string
  credits_purchased: number
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  created_at: string
}

// Resolution types
export type Resolution = '4k' | '1080p' | '720p'

// Resolution dimensions mapping
export const RESOLUTION_DIMENSIONS: Record<Resolution, { width: number; height: number }> = {
  '4k': { width: 3840, height: 2160 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
}
