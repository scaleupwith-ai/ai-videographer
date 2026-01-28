-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to clips table
-- Using 1536 dimensions for OpenAI text-embedding-3-small
ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add search_text column to store the combined searchable text
-- This makes it easy to see what was embedded and regenerate if needed
ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS search_text TEXT;

-- Add embedding_updated_at to track when embedding was last generated
ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for fast vector similarity search
-- Using ivfflat for good balance of speed and accuracy
CREATE INDEX IF NOT EXISTS idx_clips_embedding 
ON clips USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on search_text for full-text search fallback
CREATE INDEX IF NOT EXISTS idx_clips_search_text_gin 
ON clips USING gin(to_tsvector('english', COALESCE(search_text, '')));

-- Function to perform hybrid search (semantic + filters)
CREATE OR REPLACE FUNCTION search_clips_hybrid(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20,
  filter_min_duration float DEFAULT 0,
  filter_max_duration float DEFAULT 9999,
  filter_resolution text DEFAULT NULL,
  filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  clip_link text,
  description text,
  tags text[],
  duration_seconds float,
  thumbnail_url text,
  source_resolution text,
  scene_changes jsonb,
  search_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.clip_link,
    c.description,
    c.tags,
    c.duration_seconds,
    c.thumbnail_url,
    c.source_resolution,
    c.scene_changes,
    c.search_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM clips c
  WHERE 
    c.embedding IS NOT NULL
    AND c.clip_link IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND c.duration_seconds >= filter_min_duration
    AND c.duration_seconds <= filter_max_duration
    AND (filter_resolution IS NULL OR c.source_resolution = filter_resolution)
    AND (filter_tags IS NULL OR c.tags && filter_tags)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for tag-boosted hybrid search
CREATE OR REPLACE FUNCTION search_clips_hybrid_boosted(
  query_embedding vector(1536),
  boost_tags text[] DEFAULT NULL,
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 30,
  filter_min_duration float DEFAULT 0,
  filter_max_duration float DEFAULT 9999,
  filter_resolution text DEFAULT NULL,
  tag_boost_factor float DEFAULT 0.1
)
RETURNS TABLE (
  id uuid,
  clip_link text,
  description text,
  tags text[],
  duration_seconds float,
  thumbnail_url text,
  source_resolution text,
  scene_changes jsonb,
  search_text text,
  base_similarity float,
  tag_boost float,
  final_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.clip_link,
    c.description,
    c.tags,
    c.duration_seconds,
    c.thumbnail_url,
    c.source_resolution,
    c.scene_changes,
    c.search_text,
    1 - (c.embedding <=> query_embedding) AS base_similarity,
    CASE 
      WHEN boost_tags IS NOT NULL AND c.tags && boost_tags 
      THEN tag_boost_factor * array_length(
        ARRAY(SELECT unnest(c.tags) INTERSECT SELECT unnest(boost_tags)), 1
      )::float
      ELSE 0.0
    END AS tag_boost,
    (1 - (c.embedding <=> query_embedding)) + 
    CASE 
      WHEN boost_tags IS NOT NULL AND c.tags && boost_tags 
      THEN tag_boost_factor * COALESCE(array_length(
        ARRAY(SELECT unnest(c.tags) INTERSECT SELECT unnest(boost_tags)), 1
      ), 0)::float
      ELSE 0.0
    END AS final_score
  FROM clips c
  WHERE 
    c.embedding IS NOT NULL
    AND c.clip_link IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND c.duration_seconds >= filter_min_duration
    AND c.duration_seconds <= filter_max_duration
    AND (filter_resolution IS NULL OR c.source_resolution = filter_resolution)
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$;

-- Comments for documentation
COMMENT ON COLUMN clips.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';
COMMENT ON COLUMN clips.search_text IS 'Combined searchable text: description + tags + resolution + metadata';
COMMENT ON COLUMN clips.embedding_updated_at IS 'Timestamp when embedding was last generated';
COMMENT ON FUNCTION search_clips_hybrid IS 'Semantic search with exact filters (resolution, duration, tags)';
COMMENT ON FUNCTION search_clips_hybrid_boosted IS 'Semantic search with tag boosting for better relevance';







