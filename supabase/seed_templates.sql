-- Sample templates for the template store
-- Run this after migrations to add sample templates

-- Modern Intro Template
INSERT INTO templates (title, description, category, duration_sec, is_featured, is_public, variables, timeline_template) 
VALUES (
  'Modern Text Intro',
  'A sleek, modern intro with animated text and your brand name. Perfect for YouTube videos.',
  'intro',
  5,
  true,
  true,
  '[
    {"key": "brand_name", "type": "text", "label": "Brand Name", "default": "Your Brand", "placeholder": "Enter your brand name"},
    {"key": "tagline", "type": "text", "label": "Tagline", "default": "Quality Content", "placeholder": "Enter your tagline"},
    {"key": "primary_color", "type": "color", "label": "Primary Color", "default": "#00b4d8"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template",
      "title": "{{brand_name}} Intro",
      "type": "template",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080},
      "fps": 30
    },
    "scenes": [
      {
        "id": "scene-1",
        "assetId": null,
        "kind": "color",
        "color": "#000000",
        "durationSec": 5,
        "inSec": 0,
        "outSec": 5,
        "overlays": {
          "text": "{{brand_name}}",
          "x": 50,
          "y": 45,
          "style": {"color": "{{primary_color}}", "fontSize": 8, "fontFamily": "Arial", "duration": 5}
        },
        "transitionOut": "fade",
        "transitionDuration": 0.5
      }
    ],
    "textOverlays": [
      {
        "id": "tagline",
        "text": "{{tagline}}",
        "x": 50,
        "y": 60,
        "startTime": 1,
        "duration": 4,
        "style": {"color": "#ffffff", "fontSize": 4, "fontFamily": "Arial", "duration": 4}
      }
    ],
    "global": {
      "music": {"assetId": null, "audioUrl": null, "volume": 0.3},
      "voiceover": {"assetId": null, "volume": 1.0},
      "captions": {"enabled": false, "burnIn": false},
      "brand": {"logoAssetId": null, "logoPosition": "top-right", "logoSize": 80, "colors": {"primary": "{{primary_color}}", "text": "#ffffff"}},
      "export": {"codec": "h264", "crf": 23, "bitrateMbps": 8, "audioKbps": 192}
    }
  }'::jsonb
);

-- Subscribe CTA Outro
INSERT INTO templates (title, description, category, duration_sec, is_featured, is_public, variables, timeline_template) 
VALUES (
  'Subscribe Call-to-Action',
  'Animated subscribe button with like reminder. Great for YouTube outros.',
  'outro',
  7,
  true,
  true,
  '[
    {"key": "channel_name", "type": "text", "label": "Channel Name", "default": "My Channel", "placeholder": "Your channel name"},
    {"key": "cta_text", "type": "text", "label": "Call to Action", "default": "Subscribe for more!", "placeholder": "Your call to action"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template",
      "title": "Subscribe CTA",
      "type": "template",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080},
      "fps": 30
    },
    "scenes": [
      {
        "id": "scene-1",
        "assetId": null,
        "kind": "color",
        "color": "#1a1a2e",
        "durationSec": 7,
        "inSec": 0,
        "outSec": 7,
        "overlays": {
          "text": "{{channel_name}}",
          "x": 50,
          "y": 30,
          "style": {"color": "#ffffff", "fontSize": 7, "fontFamily": "Arial", "duration": 7}
        },
        "transitionOut": null
      }
    ],
    "textOverlays": [
      {
        "id": "cta",
        "text": "{{cta_text}}",
        "x": 50,
        "y": 55,
        "startTime": 1.5,
        "duration": 5.5,
        "style": {"color": "#ff0000", "fontSize": 5, "fontFamily": "Arial", "duration": 5.5}
      },
      {
        "id": "like",
        "text": "👍 Like & Subscribe! 🔔",
        "x": 50,
        "y": 75,
        "startTime": 2.5,
        "duration": 4.5,
        "style": {"color": "#ffffff", "fontSize": 4, "fontFamily": "Arial", "duration": 4.5}
      }
    ],
    "global": {
      "music": {"assetId": null, "audioUrl": null, "volume": 0.2},
      "voiceover": {"assetId": null, "volume": 1.0},
      "captions": {"enabled": false, "burnIn": false},
      "brand": {"logoAssetId": null, "logoPosition": "top-right", "logoSize": 80, "colors": {"primary": "#ff0000", "text": "#ffffff"}},
      "export": {"codec": "h264", "crf": 23, "bitrateMbps": 8, "audioKbps": 192}
    }
  }'::jsonb
);

-- Product Showcase
INSERT INTO templates (title, description, category, duration_sec, is_featured, is_public, variables, timeline_template) 
VALUES (
  'Product Showcase',
  'Highlight your product with dynamic text overlays. Perfect for e-commerce.',
  'promo',
  15,
  false,
  true,
  '[
    {"key": "product_name", "type": "text", "label": "Product Name", "default": "Amazing Product", "placeholder": "Your product name"},
    {"key": "feature_1", "type": "text", "label": "Feature 1", "default": "Premium Quality", "placeholder": "Key feature"},
    {"key": "feature_2", "type": "text", "label": "Feature 2", "default": "Fast Shipping", "placeholder": "Another feature"},
    {"key": "price", "type": "text", "label": "Price", "default": "$99", "placeholder": "Price or CTA"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template",
      "title": "{{product_name}} Showcase",
      "type": "template",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080},
      "fps": 30
    },
    "scenes": [
      {
        "id": "scene-intro",
        "assetId": null,
        "kind": "color",
        "color": "#000000",
        "durationSec": 3,
        "inSec": 0,
        "outSec": 3,
        "overlays": {
          "text": "Introducing",
          "x": 50,
          "y": 50,
          "style": {"color": "#ffffff", "fontSize": 5, "fontFamily": "Arial", "duration": 3}
        },
        "transitionOut": "fade",
        "transitionDuration": 0.5
      },
      {
        "id": "scene-product",
        "assetId": null,
        "kind": "color",
        "color": "#1a1a2e",
        "durationSec": 5,
        "inSec": 0,
        "outSec": 5,
        "overlays": {
          "text": "{{product_name}}",
          "x": 50,
          "y": 50,
          "style": {"color": "#00b4d8", "fontSize": 8, "fontFamily": "Arial", "duration": 5}
        },
        "transitionOut": "dissolve",
        "transitionDuration": 0.5
      },
      {
        "id": "scene-features",
        "assetId": null,
        "kind": "color",
        "color": "#16213e",
        "durationSec": 4,
        "inSec": 0,
        "outSec": 4,
        "overlays": {
          "text": "✓ {{feature_1}}  ✓ {{feature_2}}",
          "x": 50,
          "y": 50,
          "style": {"color": "#ffffff", "fontSize": 5, "fontFamily": "Arial", "duration": 4}
        },
        "transitionOut": "fade",
        "transitionDuration": 0.5
      },
      {
        "id": "scene-cta",
        "assetId": null,
        "kind": "color",
        "color": "#0f3460",
        "durationSec": 3,
        "inSec": 0,
        "outSec": 3,
        "overlays": {
          "text": "Only {{price}}",
          "x": 50,
          "y": 50,
          "style": {"color": "#f1c40f", "fontSize": 9, "fontFamily": "Arial", "duration": 3}
        },
        "transitionOut": null
      }
    ],
    "global": {
      "music": {"assetId": null, "audioUrl": null, "volume": 0.3},
      "voiceover": {"assetId": null, "volume": 1.0},
      "captions": {"enabled": false, "burnIn": false},
      "brand": {"logoAssetId": null, "logoPosition": "bottom-right", "logoSize": 60, "colors": {"primary": "#00b4d8", "text": "#ffffff"}},
      "export": {"codec": "h264", "crf": 23, "bitrateMbps": 8, "audioKbps": 192}
    }
  }'::jsonb
);







