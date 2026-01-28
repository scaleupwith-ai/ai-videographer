-- Add tags column to music table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'music' AND column_name = 'tags') THEN
    ALTER TABLE music ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Drop genre column from music table if it exists (no longer needed)
ALTER TABLE music DROP COLUMN IF EXISTS genre;

-- Drop category column from sound_effects table if it exists (using description instead)
ALTER TABLE sound_effects DROP COLUMN IF EXISTS category;

-- Drop category column from overlays table if it exists (using tags instead)
ALTER TABLE overlays DROP COLUMN IF EXISTS category;

-- Add tags column to overlays table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'overlays' AND column_name = 'tags') THEN
    ALTER TABLE overlays ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Add tags column to sound_effects table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sound_effects' AND column_name = 'tags') THEN
    ALTER TABLE sound_effects ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
END $$;







