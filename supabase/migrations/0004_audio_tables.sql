-- Music tracks table (public library)
CREATE TABLE IF NOT EXISTS music (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  duration_seconds NUMERIC(10, 2) NOT NULL,
  audio_url TEXT NOT NULL,
  thumbnail_url TEXT,
  genre TEXT,
  mood TEXT[],
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sound effects table (public library)
CREATE TABLE IF NOT EXISTS sound_effects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  duration_seconds NUMERIC(10, 2) NOT NULL,
  audio_url TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Overlays/Graphics table (public library)
CREATE TABLE IF NOT EXISTS overlays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT, -- e.g., 'subscribe', 'like', 'arrow', 'frame', 'badge'
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add thumbnail_url to clips table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clips' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE clips ADD COLUMN thumbnail_url TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE music ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlays ENABLE ROW LEVEL SECURITY;

-- Public read access (using DO block to avoid duplicates)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'music' AND policyname = 'Anyone can read music') THEN
    CREATE POLICY "Anyone can read music" ON music FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sound_effects' AND policyname = 'Anyone can read sound_effects') THEN
    CREATE POLICY "Anyone can read sound_effects" ON sound_effects FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'overlays' AND policyname = 'Anyone can read overlays') THEN
    CREATE POLICY "Anyone can read overlays" ON overlays FOR SELECT USING (true);
  END IF;
END $$;

-- Admin write access (service role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'music' AND policyname = 'Service role can manage music') THEN
    CREATE POLICY "Service role can manage music" ON music FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sound_effects' AND policyname = 'Service role can manage sound_effects') THEN
    CREATE POLICY "Service role can manage sound_effects" ON sound_effects FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'overlays' AND policyname = 'Service role can manage overlays') THEN
    CREATE POLICY "Service role can manage overlays" ON overlays FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_music_genre ON music(genre);
CREATE INDEX IF NOT EXISTS idx_music_tags ON music USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_sound_effects_category ON sound_effects(category);
CREATE INDEX IF NOT EXISTS idx_sound_effects_tags ON sound_effects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_overlays_category ON overlays(category);
CREATE INDEX IF NOT EXISTS idx_overlays_tags ON overlays USING GIN(tags);

