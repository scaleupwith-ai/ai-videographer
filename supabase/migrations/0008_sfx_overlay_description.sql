-- Add description column to sound_effects table
ALTER TABLE sound_effects ADD COLUMN IF NOT EXISTS description TEXT;

-- Add description column to overlays table
ALTER TABLE overlays ADD COLUMN IF NOT EXISTS description TEXT;







