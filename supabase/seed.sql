-- Seed data for AI Videographer
-- Note: This requires a user to be created first

-- Create a demo brand preset (will need to update owner_id after user creation)
-- For testing, you can run this after creating a user and replace the UUID

-- Example: Create demo brand preset for user
-- INSERT INTO brand_presets (owner_id, name, colors, fonts, overlay_style)
-- VALUES (
--   'YOUR_USER_ID_HERE',
--   'Default Brand',
--   '{"primary": "#00b4d8", "secondary": "#0077b6", "accent": "#ff6b6b", "text": "#ffffff", "background": "#1a1a2e"}'::jsonb,
--   '{"heading": "Space Grotesk", "body": "Inter"}'::jsonb,
--   'lower_third'
-- );

-- Example: Create a demo project with sample timeline JSON
-- INSERT INTO projects (owner_id, title, type, status, aspect_ratio, timeline_json)
-- VALUES (
--   'YOUR_USER_ID_HERE',
--   'Demo Product Video',
--   'product_promo',
--   'draft',
--   'landscape',
--   '{
--     "version": 1,
--     "project": {
--       "id": "demo-project",
--       "title": "Demo Product Video",
--       "type": "product_promo",
--       "aspectRatio": "landscape",
--       "resolution": { "width": 1920, "height": 1080 },
--       "fps": 30
--     },
--     "scenes": [
--       {
--         "id": "scene-1",
--         "assetId": null,
--         "kind": "video",
--         "inSec": 0,
--         "outSec": 5,
--         "durationSec": 5,
--         "cropMode": "cover",
--         "overlays": {
--           "title": "Welcome to Our Product",
--           "subtitle": "The best solution for your needs",
--           "position": "center",
--           "stylePreset": "boxed"
--         },
--         "transitionOut": "crossfade"
--       },
--       {
--         "id": "scene-2",
--         "assetId": null,
--         "kind": "video",
--         "inSec": 0,
--         "outSec": 4,
--         "durationSec": 4,
--         "cropMode": "cover",
--         "overlays": {
--           "title": "Key Features",
--           "subtitle": null,
--           "position": "lower_third",
--           "stylePreset": "lower_third"
--         },
--         "transitionOut": "crossfade"
--       },
--       {
--         "id": "scene-3",
--         "assetId": null,
--         "kind": "image",
--         "inSec": 0,
--         "outSec": 3,
--         "durationSec": 3,
--         "cropMode": "cover",
--         "overlays": {
--           "title": "Get Started Today",
--           "subtitle": "Visit our website",
--           "position": "center",
--           "stylePreset": "minimal"
--         },
--         "transitionOut": null
--       }
--     ],
--     "global": {
--       "music": {
--         "assetId": null,
--         "volume": 0.3
--       },
--       "voiceover": {
--         "assetId": null,
--         "volume": 1.0
--       },
--       "captions": {
--         "enabled": false,
--         "burnIn": false,
--         "srtAssetId": null
--       },
--       "brand": {
--         "presetId": null,
--         "logoAssetId": null,
--         "logoPosition": "top-right",
--         "logoSize": 80,
--         "colors": {
--           "primary": "#00b4d8",
--           "secondary": "#0077b6",
--           "accent": "#ff6b6b",
--           "text": "#ffffff"
--         },
--         "safeMargins": {
--           "top": 50,
--           "bottom": 50,
--           "left": 50,
--           "right": 50
--         }
--       },
--       "export": {
--         "codec": "h264",
--         "bitrateMbps": 10,
--         "crf": 23,
--         "audioKbps": 192
--       }
--     },
--     "rendering": {
--       "output": {
--         "url": null,
--         "thumbnailUrl": null,
--         "durationSec": null,
--         "sizeBytes": null
--       }
--     }
--   }'::jsonb
-- );

-- Function to create demo data for a user
CREATE OR REPLACE FUNCTION create_demo_data_for_user(user_uuid UUID)
RETURNS void AS $$
DECLARE
  brand_id UUID;
BEGIN
  -- Create brand preset
  INSERT INTO brand_presets (owner_id, name, colors, fonts, overlay_style)
  VALUES (
    user_uuid,
    'Default Brand',
    '{"primary": "#00b4d8", "secondary": "#0077b6", "accent": "#ff6b6b", "text": "#ffffff", "background": "#1a1a2e"}'::jsonb,
    '{"heading": "Space Grotesk", "body": "Inter"}'::jsonb,
    'lower_third'
  )
  RETURNING id INTO brand_id;

  -- Create demo project
  INSERT INTO projects (owner_id, title, type, status, aspect_ratio, brand_preset_id, timeline_json)
  VALUES (
    user_uuid,
    'Demo Product Video',
    'product_promo',
    'draft',
    'landscape',
    brand_id,
    '{
      "version": 1,
      "project": {
        "id": "demo-project",
        "title": "Demo Product Video",
        "type": "product_promo",
        "aspectRatio": "landscape",
        "resolution": { "width": 1920, "height": 1080 },
        "fps": 30
      },
      "scenes": [],
      "global": {
        "music": { "assetId": null, "volume": 0.3 },
        "voiceover": { "assetId": null, "volume": 1.0 },
        "captions": { "enabled": false, "burnIn": false, "srtAssetId": null },
        "brand": {
          "presetId": null,
          "logoAssetId": null,
          "logoPosition": "top-right",
          "logoSize": 80,
          "colors": { "primary": "#00b4d8", "secondary": "#0077b6", "accent": "#ff6b6b", "text": "#ffffff" },
          "safeMargins": { "top": 50, "bottom": 50, "left": 50, "right": 50 }
        },
        "export": { "codec": "h264", "bitrateMbps": 10, "crf": 23, "audioKbps": 192 }
      },
      "rendering": { "output": { "url": null, "thumbnailUrl": null, "durationSec": null, "sizeBytes": null } }
    }'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

