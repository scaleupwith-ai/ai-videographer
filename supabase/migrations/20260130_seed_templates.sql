-- Seed sample templates for testing
-- These templates have full timeline JSON that can be rendered

-- Delete any existing templates first (for clean testing)
DELETE FROM templates WHERE title IN (
  'Clean Fade Intro',
  'Logo Reveal Intro',
  'Professional Outro',
  'Subscribe CTA Outro',
  'Quick Product Promo',
  'Simple Announcement',
  'Kinetic Text Intro',
  'Minimal Lower Third',
  'Social Media Promo',
  'Event Countdown',
  'Quote Card',
  'Testimonial Spotlight',
  'Feature Highlight',
  'Coming Soon Teaser'
);

-- Template 1: Clean Fade Intro (5 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Clean Fade Intro',
  'A simple, elegant intro with your logo and company name fading in',
  'intro',
  5,
  true,
  true,
  '[
    {"key": "company_name", "type": "text", "label": "Company Name", "default": "Your Company", "placeholder": "Enter your company name"},
    {"key": "tagline", "type": "text", "label": "Tagline", "default": "Making great videos", "placeholder": "Your tagline"},
    {"key": "primary_color", "type": "color", "label": "Primary Color", "default": "#00f0ff"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-clean-fade",
      "title": "{{company_name}} Intro",
      "type": "intro",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#1a1f24",
        "durationSec": 5,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "title-text",
        "text": "{{company_name}}",
        "startTime": 0.5,
        "duration": 4,
        "position": {"x": 50, "y": 45},
        "style": {"fontSize": 72, "color": "#ffffff", "fontWeight": "bold"}
      },
      {
        "id": "tagline-text",
        "text": "{{tagline}}",
        "startTime": 1.5,
        "duration": 3,
        "position": {"x": 50, "y": 58},
        "style": {"fontSize": 32, "color": "{{primary_color}}"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 5
    }
  }'::jsonb
);

-- Template 2: Logo Reveal Intro (6 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Logo Reveal Intro',
  'Dynamic logo reveal with animated background',
  'intro',
  6,
  true,
  true,
  '[
    {"key": "company_name", "type": "text", "label": "Company Name", "default": "ACME Corp"},
    {"key": "accent_color", "type": "color", "label": "Accent Color", "default": "#00f0ff"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-logo-reveal",
      "title": "{{company_name}} Logo Reveal",
      "type": "intro",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#2A2F38",
        "durationSec": 6,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "title-text",
        "text": "{{company_name}}",
        "startTime": 1,
        "duration": 4.5,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 96, "color": "{{accent_color}}", "fontWeight": "bold"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 6
    }
  }'::jsonb
);

-- Template 3: Professional Outro (5 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Professional Outro',
  'Clean outro with website and social media handles',
  'outro',
  5,
  true,
  true,
  '[
    {"key": "company_name", "type": "text", "label": "Company Name", "default": "Your Company"},
    {"key": "website", "type": "text", "label": "Website", "default": "www.example.com"},
    {"key": "cta_text", "type": "text", "label": "Call to Action", "default": "Visit us today!"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-pro-outro",
      "title": "{{company_name}} Outro",
      "type": "outro",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#1a1f24",
        "durationSec": 5,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "company-text",
        "text": "{{company_name}}",
        "startTime": 0,
        "duration": 5,
        "position": {"x": 50, "y": 35},
        "style": {"fontSize": 64, "color": "#ffffff", "fontWeight": "bold"}
      },
      {
        "id": "cta-text",
        "text": "{{cta_text}}",
        "startTime": 0.5,
        "duration": 4,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 36, "color": "#00f0ff"}
      },
      {
        "id": "website-text",
        "text": "{{website}}",
        "startTime": 1,
        "duration": 4,
        "position": {"x": 50, "y": 65},
        "style": {"fontSize": 28, "color": "#8b9caf"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 5
    }
  }'::jsonb
);

-- Template 4: Subscribe CTA Outro (4 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Subscribe CTA Outro',
  'YouTube-style subscribe call to action',
  'outro',
  4,
  true,
  false,
  '[
    {"key": "channel_name", "type": "text", "label": "Channel Name", "default": "My Channel"},
    {"key": "subscribe_text", "type": "text", "label": "Subscribe Text", "default": "Subscribe for more!"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-subscribe-cta",
      "title": "Subscribe CTA",
      "type": "outro",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#0f0f0f",
        "durationSec": 4,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "subscribe-text",
        "text": "{{subscribe_text}}",
        "startTime": 0,
        "duration": 4,
        "position": {"x": 50, "y": 40},
        "style": {"fontSize": 56, "color": "#ffffff", "fontWeight": "bold"}
      },
      {
        "id": "channel-text",
        "text": "{{channel_name}}",
        "startTime": 0.5,
        "duration": 3.5,
        "position": {"x": 50, "y": 60},
        "style": {"fontSize": 36, "color": "#ff0000"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 4
    }
  }'::jsonb
);

-- Template 5: Quick Product Promo (15 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Quick Product Promo',
  'Fast-paced product promotional video',
  'promo',
  15,
  true,
  true,
  '[
    {"key": "product_name", "type": "text", "label": "Product Name", "default": "Amazing Product"},
    {"key": "tagline", "type": "text", "label": "Tagline", "default": "The best solution for you"},
    {"key": "price", "type": "text", "label": "Price", "default": "$99"},
    {"key": "cta", "type": "text", "label": "Call to Action", "default": "Order Now!"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-product-promo",
      "title": "{{product_name}} Promo",
      "type": "promo",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#1a1f24",
        "durationSec": 5,
        "startTimeSec": 0
      },
      {
        "id": "scene-2",
        "type": "solid",
        "backgroundColor": "#2A2F38",
        "durationSec": 5,
        "startTimeSec": 5
      },
      {
        "id": "scene-3",
        "type": "solid",
        "backgroundColor": "#36454f",
        "durationSec": 5,
        "startTimeSec": 10
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "product-name",
        "text": "{{product_name}}",
        "startTime": 0,
        "duration": 5,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 72, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "tagline",
        "text": "{{tagline}}",
        "startTime": 5,
        "duration": 5,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 48, "color": "#ffffff"}
      },
      {
        "id": "price",
        "text": "{{price}}",
        "startTime": 10,
        "duration": 2.5,
        "position": {"x": 50, "y": 40},
        "style": {"fontSize": 96, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "cta",
        "text": "{{cta}}",
        "startTime": 12,
        "duration": 3,
        "position": {"x": 50, "y": 60},
        "style": {"fontSize": 48, "color": "#ffffff"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 15
    }
  }'::jsonb
);

-- Template 6: Simple Announcement (10 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Simple Announcement',
  'Clean announcement video for news or updates',
  'promo',
  10,
  true,
  false,
  '[
    {"key": "headline", "type": "text", "label": "Headline", "default": "Big News!"},
    {"key": "body", "type": "text", "label": "Details", "default": "Something amazing is coming"},
    {"key": "date", "type": "text", "label": "Date/Info", "default": "Coming Soon"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-announcement",
      "title": "Announcement",
      "type": "promo",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#1a1f24",
        "durationSec": 10,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "headline",
        "text": "{{headline}}",
        "startTime": 0,
        "duration": 10,
        "position": {"x": 50, "y": 35},
        "style": {"fontSize": 72, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "body",
        "text": "{{body}}",
        "startTime": 1,
        "duration": 8,
        "position": {"x": 50, "y": 55},
        "style": {"fontSize": 36, "color": "#ffffff"}
      },
      {
        "id": "date",
        "text": "{{date}}",
        "startTime": 3,
        "duration": 6,
        "position": {"x": 50, "y": 75},
        "style": {"fontSize": 28, "color": "#8b9caf"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 10
    }
  }'::jsonb
);

-- Template 7: Kinetic Text Intro (6 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Kinetic Text Intro',
  'Bold animated text reveal with gradient background',
  'intro',
  6,
  true,
  true,
  '[
    {"key": "main_text", "type": "text", "label": "Main Text", "default": "WELCOME"},
    {"key": "sub_text", "type": "text", "label": "Subtitle", "default": "Let''s get started"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-kinetic-intro",
      "title": "{{main_text}}",
      "type": "intro",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#0a0f14",
        "durationSec": 6,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "main",
        "text": "{{main_text}}",
        "startTime": 0.5,
        "duration": 5,
        "position": {"x": 50, "y": 45},
        "style": {"fontSize": 120, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "sub",
        "text": "{{sub_text}}",
        "startTime": 2,
        "duration": 3.5,
        "position": {"x": 50, "y": 62},
        "style": {"fontSize": 32, "color": "#ffffff"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 6
    }
  }'::jsonb
);

-- Template 8: Quote Card (8 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Quote Card',
  'Elegant quote display with attribution',
  'social',
  8,
  true,
  true,
  '[
    {"key": "quote", "type": "text", "label": "Quote", "default": "The only way to do great work is to love what you do."},
    {"key": "author", "type": "text", "label": "Author", "default": "Steve Jobs"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-quote-card",
      "title": "Quote Card",
      "type": "social",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#1a1a2e",
        "durationSec": 8,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "quote-mark",
        "text": "\"",
        "startTime": 0,
        "duration": 8,
        "position": {"x": 15, "y": 30},
        "style": {"fontSize": 200, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "quote",
        "text": "{{quote}}",
        "startTime": 0.5,
        "duration": 7,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 42, "color": "#ffffff"}
      },
      {
        "id": "author",
        "text": "— {{author}}",
        "startTime": 2,
        "duration": 5.5,
        "position": {"x": 50, "y": 75},
        "style": {"fontSize": 28, "color": "#00f0ff"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 8
    }
  }'::jsonb
);

-- Template 9: Testimonial Spotlight (10 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Testimonial Spotlight',
  'Customer testimonial with name and company',
  'promo',
  10,
  true,
  false,
  '[
    {"key": "testimonial", "type": "text", "label": "Testimonial", "default": "This product changed everything for our business!"},
    {"key": "name", "type": "text", "label": "Customer Name", "default": "Jane Smith"},
    {"key": "company", "type": "text", "label": "Company", "default": "ABC Corp"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-testimonial",
      "title": "Testimonial",
      "type": "promo",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#16213e",
        "durationSec": 10,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "stars",
        "text": "★★★★★",
        "startTime": 0,
        "duration": 10,
        "position": {"x": 50, "y": 25},
        "style": {"fontSize": 48, "color": "#ffd700"}
      },
      {
        "id": "quote",
        "text": "\"{{testimonial}}\"",
        "startTime": 0.5,
        "duration": 9,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 36, "color": "#ffffff"}
      },
      {
        "id": "name",
        "text": "{{name}}",
        "startTime": 2,
        "duration": 7.5,
        "position": {"x": 50, "y": 72},
        "style": {"fontSize": 28, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "company",
        "text": "{{company}}",
        "startTime": 2.5,
        "duration": 7,
        "position": {"x": 50, "y": 82},
        "style": {"fontSize": 22, "color": "#8b9caf"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 10
    }
  }'::jsonb
);

-- Template 10: Feature Highlight (8 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Feature Highlight',
  'Highlight a single feature with icon placeholder',
  'promo',
  8,
  true,
  false,
  '[
    {"key": "feature_name", "type": "text", "label": "Feature Name", "default": "Lightning Fast"},
    {"key": "description", "type": "text", "label": "Description", "default": "Process data 10x faster than competitors"},
    {"key": "icon_text", "type": "text", "label": "Icon/Emoji", "default": "⚡"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-feature",
      "title": "Feature Highlight",
      "type": "promo",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#0f172a",
        "durationSec": 8,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "icon",
        "text": "{{icon_text}}",
        "startTime": 0,
        "duration": 8,
        "position": {"x": 50, "y": 30},
        "style": {"fontSize": 96, "color": "#ffffff"}
      },
      {
        "id": "title",
        "text": "{{feature_name}}",
        "startTime": 0.5,
        "duration": 7,
        "position": {"x": 50, "y": 55},
        "style": {"fontSize": 56, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "desc",
        "text": "{{description}}",
        "startTime": 1.5,
        "duration": 6,
        "position": {"x": 50, "y": 72},
        "style": {"fontSize": 28, "color": "#94a3b8"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 8
    }
  }'::jsonb
);

-- Template 11: Coming Soon Teaser (7 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Coming Soon Teaser',
  'Build anticipation for upcoming launches',
  'promo',
  7,
  true,
  true,
  '[
    {"key": "product_name", "type": "text", "label": "Product Name", "default": "Something Big"},
    {"key": "date", "type": "text", "label": "Launch Date", "default": "March 2026"},
    {"key": "teaser", "type": "text", "label": "Teaser Text", "default": "Are you ready?"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-coming-soon",
      "title": "Coming Soon",
      "type": "promo",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#000000",
        "durationSec": 7,
        "startTimeSec": 0
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "teaser",
        "text": "{{teaser}}",
        "startTime": 0,
        "duration": 3,
        "position": {"x": 50, "y": 45},
        "style": {"fontSize": 36, "color": "#8b9caf"}
      },
      {
        "id": "product",
        "text": "{{product_name}}",
        "startTime": 2,
        "duration": 4.5,
        "position": {"x": 50, "y": 45},
        "style": {"fontSize": 72, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "coming",
        "text": "COMING SOON",
        "startTime": 3,
        "duration": 3.5,
        "position": {"x": 50, "y": 62},
        "style": {"fontSize": 24, "color": "#ffffff"}
      },
      {
        "id": "date",
        "text": "{{date}}",
        "startTime": 4,
        "duration": 2.5,
        "position": {"x": 50, "y": 75},
        "style": {"fontSize": 32, "color": "#00f0ff"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 7
    }
  }'::jsonb
);

-- Template 12: Social Media Promo (12 seconds)
INSERT INTO templates (title, description, category, duration_sec, is_public, is_featured, variables, timeline_template) VALUES (
  'Social Media Promo',
  'Multi-slide social media announcement',
  'social',
  12,
  true,
  true,
  '[
    {"key": "hook", "type": "text", "label": "Hook Line", "default": "Stop scrolling!"},
    {"key": "main_point", "type": "text", "label": "Main Point", "default": "This will change everything"},
    {"key": "cta", "type": "text", "label": "Call to Action", "default": "Link in bio →"}
  ]'::jsonb,
  '{
    "version": 1,
    "project": {
      "id": "template-social-promo",
      "title": "Social Promo",
      "type": "social",
      "aspectRatio": "landscape",
      "resolution": {"width": 1920, "height": 1080}
    },
    "scenes": [
      {
        "id": "scene-1",
        "type": "solid",
        "backgroundColor": "#1a1f24",
        "durationSec": 4,
        "startTimeSec": 0
      },
      {
        "id": "scene-2",
        "type": "solid",
        "backgroundColor": "#2A2F38",
        "durationSec": 5,
        "startTimeSec": 4
      },
      {
        "id": "scene-3",
        "type": "solid",
        "backgroundColor": "#00f0ff",
        "durationSec": 3,
        "startTimeSec": 9
      }
    ],
    "soundEffects": [],
    "imageOverlays": [],
    "textOverlays": [
      {
        "id": "hook",
        "text": "{{hook}}",
        "startTime": 0,
        "duration": 4,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 72, "color": "#00f0ff", "fontWeight": "bold"}
      },
      {
        "id": "main",
        "text": "{{main_point}}",
        "startTime": 4,
        "duration": 5,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 56, "color": "#ffffff", "fontWeight": "bold"}
      },
      {
        "id": "cta",
        "text": "{{cta}}",
        "startTime": 9,
        "duration": 3,
        "position": {"x": 50, "y": 50},
        "style": {"fontSize": 48, "color": "#000000", "fontWeight": "bold"}
      }
    ],
    "global": {
      "music": {"assetId": null, "volume": 0},
      "voiceover": {"assetId": null, "volume": 0},
      "captions": {"enabled": false},
      "brand": {"logoAssetId": null}
    },
    "rendering": {
      "output": {},
      "totalDurationSec": 12
    }
  }'::jsonb
);

