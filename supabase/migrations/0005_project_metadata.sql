-- Add script and description columns to projects table
-- These store the original prompt/script used to create the video

ALTER TABLE projects ADD COLUMN IF NOT EXISTS script TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN projects.script IS 'The voiceover script used to generate this video';
COMMENT ON COLUMN projects.description IS 'User description of what video they wanted';







