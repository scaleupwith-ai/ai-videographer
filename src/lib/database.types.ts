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
          filename: string
          mime_type: string
          size_bytes: number
          storage_key: string
          url: string
          thumbnail_url: string | null
          duration_sec: number | null
          width: number | null
          height: number | null
          asset_type: 'video' | 'image' | 'audio'
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          filename: string
          mime_type: string
          size_bytes: number
          storage_key: string
          url: string
          thumbnail_url?: string | null
          duration_sec?: number | null
          width?: number | null
          height?: number | null
          asset_type: 'video' | 'image' | 'audio'
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          filename?: string
          mime_type?: string
          size_bytes?: number
          storage_key?: string
          url?: string
          thumbnail_url?: string | null
          duration_sec?: number | null
          width?: number | null
          height?: number | null
          asset_type?: 'video' | 'image' | 'audio'
          created_at?: string
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
    }
  }
}

export type Project = Database['public']['Tables']['projects']['Row']
export type MediaAsset = Database['public']['Tables']['media_assets']['Row']
export type BrandPreset = Database['public']['Tables']['brand_presets']['Row']
export type RenderJob = Database['public']['Tables']['render_jobs']['Row']
export type Clip = Database['public']['Tables']['clips']['Row']
