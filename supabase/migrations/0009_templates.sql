-- Templates table for video templates (intros, outros, etc.)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- intro, outro, promo, educational, etc.
  thumbnail_url TEXT,
  preview_url TEXT,
  
  -- Template configuration
  timeline_template JSONB NOT NULL, -- The timeline JSON with placeholders
  variables JSONB NOT NULL DEFAULT '[]', -- Array of variable definitions
  
  -- Example: variables = [
  --   { "key": "title", "type": "text", "label": "Video Title", "default": "My Video" },
  --   { "key": "product_image", "type": "image", "label": "Product Image" },
  --   { "key": "cta_text", "type": "text", "label": "Call to Action", "default": "Learn More" }
  -- ]
  
  -- Metadata
  duration_sec INTEGER,
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Public read access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read public templates' AND tablename = 'templates') THEN
    CREATE POLICY "Anyone can read public templates" ON templates FOR SELECT USING (is_public = true);
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_featured ON templates(is_featured) WHERE is_featured = true;







