-- Remove unused columns from music table
ALTER TABLE music DROP COLUMN IF EXISTS bpm;
ALTER TABLE music DROP COLUMN IF EXISTS is_loopable;







