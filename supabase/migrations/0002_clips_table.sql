-- Clips table for storing b-roll footage from Google Drive
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_link TEXT NOT NULL, -- Google Drive share link
  duration_seconds DECIMAL(10, 2) NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for tag-based searches
CREATE INDEX idx_clips_tags ON clips USING GIN (tags);

-- Full-text search index on description
CREATE INDEX idx_clips_description ON clips USING GIN (to_tsvector('english', COALESCE(description, '')));

-- RLS policies
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view clips (shared b-roll library)
CREATE POLICY "Authenticated users can view clips" ON clips
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can insert/update/delete (admin managed)
CREATE POLICY "Service role can manage clips" ON clips
  FOR ALL USING (auth.role() = 'service_role');

-- Function to search clips by text and tags
CREATE OR REPLACE FUNCTION search_clips(
  search_query TEXT DEFAULT NULL,
  tag_filter TEXT[] DEFAULT NULL,
  result_limit INT DEFAULT 20
)
RETURNS SETOF clips AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM clips
  WHERE
    (search_query IS NULL OR 
     to_tsvector('english', COALESCE(description, '')) @@ plainto_tsquery('english', search_query) OR
     description ILIKE '%' || search_query || '%')
    AND
    (tag_filter IS NULL OR tags && tag_filter)
  ORDER BY 
    CASE WHEN search_query IS NOT NULL 
         THEN ts_rank(to_tsvector('english', COALESCE(description, '')), plainto_tsquery('english', search_query))
         ELSE 0 
    END DESC,
    created_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;







