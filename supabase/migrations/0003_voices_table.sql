-- Voices table for ElevenLabs voice profiles
CREATE TABLE voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  eleven_labs_id TEXT NOT NULL UNIQUE,
  profile_image_url TEXT,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for default voice lookup
CREATE INDEX idx_voices_default ON voices (is_default) WHERE is_default = true;

-- RLS policies
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view voices
CREATE POLICY "Authenticated users can view voices" ON voices
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can manage voices (admin managed)
CREATE POLICY "Service role can manage voices" ON voices
  FOR ALL USING (auth.role() = 'service_role');

-- Insert some default voices (optional - can be removed)
-- INSERT INTO voices (name, eleven_labs_id, description, is_default) VALUES
-- ('Rachel', 'EXAVITQu4vr4xnSDxMaL', 'Warm female voice, great for narration', true);

