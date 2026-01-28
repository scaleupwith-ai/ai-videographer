-- Add scene_changes column to clips table
-- This stores detected scene change timestamps from FFmpeg scene detection
-- Format: [{"timestamp": 5.2, "score": 0.45}, {"timestamp": 12.8, "score": 0.52}]

ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS scene_changes JSONB DEFAULT '[]'::jsonb;

-- Add index for clips that have scene changes detected
CREATE INDEX IF NOT EXISTS idx_clips_has_scene_changes 
ON clips ((scene_changes IS NOT NULL AND jsonb_array_length(scene_changes) > 0));

-- Comment for documentation
COMMENT ON COLUMN clips.scene_changes IS 'Array of detected scene changes with timestamps and scores from FFmpeg scene detection. Format: [{timestamp: number, score: number}]';







