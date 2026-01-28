-- Add resolution tracking to clips table
-- ============================================

-- Add resolution column to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS resolution TEXT DEFAULT '1080p';
ALTER TABLE clips ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS height INTEGER;

-- Create clip_variants table for multi-resolution support
CREATE TABLE IF NOT EXISTS clip_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  resolution TEXT NOT NULL, -- '4k', '1080p', '720p'
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  clip_link TEXT NOT NULL, -- URL to the variant video file
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_clip_variants_clip_id ON clip_variants(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_variants_resolution ON clip_variants(resolution);

-- Add resolution column to media_assets for user uploads
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS resolution TEXT DEFAULT '1080p';

-- Function to get clips filtered by resolution
CREATE OR REPLACE FUNCTION search_clips_by_resolution(
  search_query TEXT DEFAULT NULL,
  tag_filter TEXT[] DEFAULT NULL,
  target_resolution TEXT DEFAULT '1080p',
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  clip_link TEXT,
  duration_seconds NUMERIC,
  description TEXT,
  tags TEXT[],
  thumbnail_url TEXT,
  resolution TEXT,
  width INTEGER,
  height INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    -- Return variant link if available, otherwise original
    COALESCE(cv.clip_link, c.clip_link) as clip_link,
    c.duration_seconds,
    c.description,
    c.tags,
    c.thumbnail_url,
    COALESCE(cv.resolution, c.resolution) as resolution,
    COALESCE(cv.width, c.width) as width,
    COALESCE(cv.height, c.height) as height
  FROM clips c
  LEFT JOIN clip_variants cv ON cv.clip_id = c.id AND cv.resolution = target_resolution
  WHERE 
    -- Only return clips that have the target resolution (either native or as variant)
    (c.resolution = target_resolution OR cv.id IS NOT NULL)
    -- Text search on description
    AND (search_query IS NULL OR c.description ILIKE '%' || search_query || '%')
    -- Tag filter
    AND (tag_filter IS NULL OR c.tags && tag_filter)
  ORDER BY c.created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Comment on the table
COMMENT ON TABLE clip_variants IS 'Stores resolution variants for clips (e.g., 720p version of a 4k clip)';
COMMENT ON COLUMN clips.resolution IS 'Original/native resolution of the clip: 4k, 1080p, or 720p';


