-- Add brand color columns to user_settings table
-- These colors are used for video effects and overlays

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#00f0ff',
ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#36454f',
ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#ff7f50';

-- Add comment for documentation
COMMENT ON COLUMN user_settings.brand_primary_color IS 'Primary brand color for effects (default: Electric Blue)';
COMMENT ON COLUMN user_settings.brand_secondary_color IS 'Secondary/background brand color (default: Charcoal)';
COMMENT ON COLUMN user_settings.brand_accent_color IS 'Accent/highlight color (default: Coral)';


