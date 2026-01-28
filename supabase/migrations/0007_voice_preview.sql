-- Add preview audio URL for voices
ALTER TABLE voices ADD COLUMN IF NOT EXISTS preview_url TEXT;

COMMENT ON COLUMN voices.preview_url IS 'Short audio snippet for previewing the voice';







