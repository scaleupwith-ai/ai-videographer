-- Add status and reference fields to media_assets for background processing
-- and product/location reference tracking

-- Add status column for tracking description generation
ALTER TABLE media_assets 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'failed'));

-- Add reference column for product name/address that AI can use
ALTER TABLE media_assets 
ADD COLUMN IF NOT EXISTS reference TEXT;

-- Add index for querying processing assets
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status) WHERE status = 'processing';

-- Comment for clarity
COMMENT ON COLUMN media_assets.status IS 'processing: AI is generating description, ready: complete, failed: AI analysis failed';
COMMENT ON COLUMN media_assets.reference IS 'User-provided product name or address for AI context';







