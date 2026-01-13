-- AI Videographer Database Schema
-- Version 1.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE project_status AS ENUM ('draft', 'rendering', 'finished', 'failed');
CREATE TYPE aspect_ratio AS ENUM ('landscape', 'vertical', 'square');
CREATE TYPE asset_kind AS ENUM ('video', 'image', 'audio', 'srt', 'logo');
CREATE TYPE overlay_style AS ENUM ('boxed', 'lower_third', 'minimal');
CREATE TYPE render_job_status AS ENUM ('queued', 'running', 'finished', 'failed');

-- ============================================
-- TABLES
-- ============================================

-- Brand Presets (logo, fonts, colors, overlay style)
CREATE TABLE brand_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_asset_id UUID, -- FK added after media_assets table
  colors JSONB DEFAULT '{"primary": "#00b4d8", "secondary": "#0077b6", "accent": "#ff6b6b", "text": "#ffffff", "background": "#1a1a2e"}'::jsonb,
  fonts JSONB DEFAULT '{"heading": "Space Grotesk", "body": "Inter"}'::jsonb,
  safe_margins JSONB DEFAULT '{"top": 50, "bottom": 50, "left": 50, "right": 50}'::jsonb,
  overlay_style overlay_style DEFAULT 'lower_third',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media Assets (uploaded clips, images, audio, logos)
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'ai-videographer',
  object_key TEXT NOT NULL,
  public_url TEXT,
  kind asset_kind NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  duration_sec NUMERIC(10, 3), -- For video/audio
  width INTEGER, -- For video/image
  height INTEGER, -- For video/image
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK for logo_asset_id after media_assets exists
ALTER TABLE brand_presets
  ADD CONSTRAINT fk_logo_asset
  FOREIGN KEY (logo_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

-- Projects (video projects with timeline JSON)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'product_promo', -- product_promo, real_estate, construction, testimonial, announcement
  status project_status DEFAULT 'draft',
  aspect_ratio aspect_ratio DEFAULT 'landscape',
  fps INTEGER DEFAULT 30,
  resolution_w INTEGER DEFAULT 1920,
  resolution_h INTEGER DEFAULT 1080,
  timeline_json JSONB, -- Timeline JSON v1 (single source of truth)
  brand_preset_id UUID REFERENCES brand_presets(id) ON DELETE SET NULL,
  output_url TEXT, -- Final rendered video URL
  thumbnail_url TEXT,
  duration_sec NUMERIC(10, 3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Render Jobs (async render progress)
CREATE TABLE render_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status render_job_status DEFAULT 'queued',
  progress NUMERIC(5, 2) DEFAULT 0, -- 0-100
  logs TEXT[] DEFAULT '{}',
  error TEXT,
  output_url TEXT,
  thumbnail_url TEXT,
  duration_sec NUMERIC(10, 3),
  size_bytes BIGINT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);

CREATE INDEX idx_media_assets_owner ON media_assets(owner_id);
CREATE INDEX idx_media_assets_kind ON media_assets(kind);

CREATE INDEX idx_brand_presets_owner ON brand_presets(owner_id);

CREATE INDEX idx_render_jobs_project ON render_jobs(project_id);
CREATE INDEX idx_render_jobs_status ON render_jobs(status);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_presets_updated_at
  BEFORE UPDATE ON brand_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_render_jobs_updated_at
  BEFORE UPDATE ON render_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

-- Projects: Owner can CRUD
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = owner_id);

-- Media Assets: Owner can CRUD
CREATE POLICY "Users can view own assets" ON media_assets
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own assets" ON media_assets
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own assets" ON media_assets
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own assets" ON media_assets
  FOR DELETE USING (auth.uid() = owner_id);

-- Brand Presets: Owner can CRUD
CREATE POLICY "Users can view own brand presets" ON brand_presets
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own brand presets" ON brand_presets
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own brand presets" ON brand_presets
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own brand presets" ON brand_presets
  FOR DELETE USING (auth.uid() = owner_id);

-- Render Jobs: Users can view jobs for their projects
CREATE POLICY "Users can view own render jobs" ON render_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = render_jobs.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Render Jobs: Users can create jobs for their own projects
CREATE POLICY "Users can create render jobs for own projects" ON render_jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = render_jobs.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Render Jobs: Service role can do everything (for worker)
-- Note: Service role bypasses RLS by default

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_id UUID)
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(size_bytes), 0)::BIGINT
  FROM media_assets
  WHERE owner_id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get project with latest render job status
CREATE OR REPLACE FUNCTION get_project_with_render_status(project_uuid UUID)
RETURNS TABLE (
  project_id UUID,
  project_title TEXT,
  project_status project_status,
  render_job_id UUID,
  render_status render_job_status,
  render_progress NUMERIC
) AS $$
  SELECT 
    p.id as project_id,
    p.title as project_title,
    p.status as project_status,
    rj.id as render_job_id,
    rj.status as render_status,
    rj.progress as render_progress
  FROM projects p
  LEFT JOIN LATERAL (
    SELECT * FROM render_jobs
    WHERE project_id = p.id
    ORDER BY created_at DESC
    LIMIT 1
  ) rj ON true
  WHERE p.id = project_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

