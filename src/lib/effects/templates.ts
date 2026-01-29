/**
 * Video Effect Templates
 * 
 * Each effect is implemented using FFmpeg filters.
 * All effects support customization via brand colors from user settings.
 * AI can automatically select and populate these effects based on video content.
 * 
 * Timing parameters:
 * - slideInDuration: How long the element takes to appear
 * - holdDuration: How long the element stays visible  
 * - slideOutDuration: How long the element takes to disappear
 */

export type EffectCategory = 
  | "lower_third"      // Name/title displays at bottom
  | "frame"            // Borders and frames
  | "shape_overlay"    // Geometric shapes

export interface EffectTemplate {
  id: string;
  name: string;
  description: string;
  category: EffectCategory;
  previewCss: string; // CSS for live preview in browser
  
  // AI usage info
  aiUsage: string; // When AI should use this effect
  aiTextFields: string[]; // Which fields AI should populate
  
  // Timing defaults (in seconds)
  defaultTiming: {
    slideIn: number;
    hold: number;
    slideOut: number;
  };
  
  // Customizable properties
  properties: EffectProperty[];
  
  // Function to generate FFmpeg filter
  generateFilter: (config: EffectConfig, resolution: { width: number; height: number }) => string;
}

export interface EffectProperty {
  key: string;
  label: string;
  type: "color" | "text" | "number" | "select" | "boolean";
  default: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLength?: number; // Character limit for text inputs
  aiGenerated?: boolean; // If true, AI will populate this field
  useBrandColor?: "primary" | "secondary" | "accent"; // Which brand color to use as default
}

export interface EffectConfig {
  [key: string]: string | number | boolean | undefined;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hexToFFmpeg(hex: string | undefined | null): string {
  if (!hex) return "0x000000"; // Default to black if undefined
  return hex.replace('#', '0x');
}

function escapeFFmpegText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

// ============================================================================
// EFFECT TEMPLATES - Streamlined for AI Usage
// ============================================================================

export const EFFECT_TEMPLATES: EffectTemplate[] = [
  // ========== LOWER THIRDS ==========
  {
    id: "lower-third-minimal",
    name: "Lower Third - Minimal Line",
    description: "Clean minimal style with animated underline for introducing speakers/topics",
    category: "lower_third",
    aiUsage: "Use when introducing a person, speaker, topic, or location. Perfect for professional videos.",
    aiTextFields: ["header", "body"],
    previewCss: `
      .effect { position: absolute; bottom: 12%; left: 5%; }
      .header { font-size: 28px; font-weight: 600; color: white; }
      .line { width: 0; height: 3px; background: var(--accent); margin-top: 8px; animation: grow 0.5s forwards; }
      @keyframes grow { to { width: 200px; } }
      .body { font-size: 18px; color: rgba(255,255,255,0.7); margin-top: 8px; }
    `,
    defaultTiming: { slideIn: 0.4, hold: 4, slideOut: 0.3 },
    properties: [
      { key: "header", label: "Header", type: "text", default: "John Smith", maxLength: 25, aiGenerated: true },
      { key: "body", label: "Subtitle", type: "text", default: "CEO & Founder", maxLength: 40, aiGenerated: true },
      { key: "lineColor", label: "Line Color", type: "color", default: "#ff7f50", useBrandColor: "accent" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
    ],
    generateFilter: (config, { width, height }) => {
      const y = height - 180;
      const lineY = y + 45;
      const slideIn = config.slideIn as number || 0.4;
      const holdEnd = slideIn + (config.hold as number || 4);
      const total = holdEnd + (config.slideOut as number || 0.3);
      
      const lineW = `if(lt(t,${slideIn}),300*t/${slideIn},if(gt(t,${holdEnd}),300*(1-(t-${holdEnd})/${config.slideOut || 0.3}),300))`;
      
      return `drawbox=x=100:y=${lineY}:w='${lineW}':h=4:color=${hexToFFmpeg(config.lineColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.header as string)}':fontsize=42:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=100:y=${y}:enable='between(t,${slideIn * 0.5},${holdEnd + (config.slideOut as number || 0.3) * 0.5})',` +
        `drawtext=text='${escapeFFmpegText(config.body as string)}':fontsize=28:fontcolor=${hexToFFmpeg(config.textColor as string)}@0.7:` +
        `x=100:y=${lineY + 20}:enable='between(t,${slideIn * 0.7},${holdEnd + (config.slideOut as number || 0.3) * 0.3})'`;
    },
  },

  // ========== SHAPE OVERLAYS ==========
  {
    id: "slide-box-left",
    name: "Slide-in Box (Left)",
    description: "Colored box slides in from left with header and body text",
    category: "shape_overlay",
    aiUsage: "Use for agenda items, key points, chapter markers, or important callouts. Good for left-aligned content.",
    aiTextFields: ["header", "body"],
    previewCss: `
      .effect { position: absolute; top: 0; left: 0; width: 50%; height: 100%; background: var(--primary); }
      .content { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
      .header { font-size: 48px; font-weight: bold; color: black; }
      .body { font-size: 24px; color: rgba(0,0,0,0.7); margin-top: 16px; }
    `,
    defaultTiming: { slideIn: 0.5, hold: 5, slideOut: 0.5 },
    properties: [
      { key: "header", label: "Header", type: "text", default: "AGENDA", maxLength: 20, aiGenerated: true },
      { key: "body", label: "Body", type: "text", default: "What we'll cover today", maxLength: 40, aiGenerated: true },
      { key: "boxColor", label: "Box Color", type: "color", default: "#00f0ff", useBrandColor: "primary" },
      { key: "textColor", label: "Text Color", type: "color", default: "#000000" },
      { key: "boxWidth", label: "Width %", type: "number", default: 50, min: 30, max: 70 },
    ],
    generateFilter: (config, { width, height }) => {
      const boxW = Math.round(width * ((config.boxWidth as number) || 50) / 100);
      const slideIn = config.slideIn as number || 0.5;
      const holdEnd = slideIn + (config.hold as number || 5);
      const slideOut = config.slideOut as number || 0.5;
      const total = holdEnd + slideOut;
      
      // Slide in from left
      const xExpr = `if(lt(t,${slideIn}),-${boxW}+${boxW}*t/${slideIn},if(gt(t,${holdEnd}),-${boxW}*(t-${holdEnd})/${slideOut},0))`;
      const textX = boxW / 2;
      
      return `drawbox=x='${xExpr}':y=0:w=${boxW}:h=${height}:color=${hexToFFmpeg(config.boxColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.header as string)}':fontsize=72:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=${textX}-text_w/2:y=${height/2 - 60}:enable='between(t,${slideIn * 0.5},${holdEnd + slideOut * 0.5})',` +
        `drawtext=text='${escapeFFmpegText(config.body as string)}':fontsize=36:fontcolor=${hexToFFmpeg(config.textColor as string)}@0.8:` +
        `x=${textX}-text_w/2:y=${height/2 + 20}:enable='between(t,${slideIn * 0.7},${holdEnd + slideOut * 0.3})'`;
    },
  },

  {
    id: "slide-box-right",
    name: "Slide-in Box (Right)",
    description: "Colored box slides in from right with header and body text",
    category: "shape_overlay",
    aiUsage: "Use for agenda items, key points, chapter markers, or important callouts. Good for right-aligned content.",
    aiTextFields: ["header", "body"],
    previewCss: `
      .effect { position: absolute; top: 0; right: 0; width: 50%; height: 100%; background: var(--primary); }
      .content { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
      .header { font-size: 48px; font-weight: bold; color: black; }
      .body { font-size: 24px; color: rgba(0,0,0,0.7); margin-top: 16px; }
    `,
    defaultTiming: { slideIn: 0.5, hold: 5, slideOut: 0.5 },
    properties: [
      { key: "header", label: "Header", type: "text", default: "KEY POINT", maxLength: 20, aiGenerated: true },
      { key: "body", label: "Body", type: "text", default: "Important takeaway", maxLength: 40, aiGenerated: true },
      { key: "boxColor", label: "Box Color", type: "color", default: "#00f0ff", useBrandColor: "primary" },
      { key: "textColor", label: "Text Color", type: "color", default: "#000000" },
      { key: "boxWidth", label: "Width %", type: "number", default: 50, min: 30, max: 70 },
    ],
    generateFilter: (config, { width, height }) => {
      const boxW = Math.round(width * ((config.boxWidth as number) || 50) / 100);
      const slideIn = config.slideIn as number || 0.5;
      const holdEnd = slideIn + (config.hold as number || 5);
      const slideOut = config.slideOut as number || 0.5;
      const total = holdEnd + slideOut;
      
      // Slide in from right
      const xExpr = `if(lt(t,${slideIn}),${width}-${boxW}*t/${slideIn},if(gt(t,${holdEnd}),${width}-${boxW}+${boxW}*(t-${holdEnd})/${slideOut},${width}-${boxW}))`;
      const textX = width - boxW / 2;
      
      return `drawbox=x='${xExpr}':y=0:w=${boxW}:h=${height}:color=${hexToFFmpeg(config.boxColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.header as string)}':fontsize=72:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=${textX}-text_w/2:y=${height/2 - 60}:enable='between(t,${slideIn * 0.5},${holdEnd + slideOut * 0.5})',` +
        `drawtext=text='${escapeFFmpegText(config.body as string)}':fontsize=36:fontcolor=${hexToFFmpeg(config.textColor as string)}@0.8:` +
        `x=${textX}-text_w/2:y=${height/2 + 20}:enable='between(t,${slideIn * 0.7},${holdEnd + slideOut * 0.3})'`;
    },
  },

  // ========== FRAMES ==========
  {
    id: "letterbox-with-text",
    name: "Letterbox Bars with Text",
    description: "Cinematic letterbox bars with optional text inside them",
    category: "frame",
    aiUsage: "Use for cinematic moments, location text, timestamps, or chapter titles. Creates movie-like feel.",
    aiTextFields: ["topText", "bottomText"],
    previewCss: `
      .bar-top { position: absolute; top: 0; left: 0; right: 0; height: 12%; background: black; 
                 display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
      .bar-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 12%; background: black;
                    display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
    `,
    defaultTiming: { slideIn: 0.5, hold: 5, slideOut: 0.5 },
    properties: [
      { key: "topText", label: "Top Bar Text", type: "text", default: "", maxLength: 50, aiGenerated: true },
      { key: "bottomText", label: "Bottom Bar Text", type: "text", default: "NEW YORK CITY", maxLength: 50, aiGenerated: true },
      { key: "barHeight", label: "Bar Height %", type: "number", default: 12, min: 5, max: 20 },
      { key: "barColor", label: "Bar Color", type: "color", default: "#000000" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
    ],
    generateFilter: (config, { width, height }) => {
      const barH = Math.round(height * ((config.barHeight as number) || 12) / 100);
      const slideIn = config.slideIn as number || 0.5;
      const holdEnd = slideIn + (config.hold as number || 5);
      const slideOut = config.slideOut as number || 0.5;
      const total = holdEnd + slideOut;
      
      // Bars slide in from top/bottom
      const topY = `if(lt(t,${slideIn}),-${barH}+${barH}*t/${slideIn},if(gt(t,${holdEnd}),-${barH}*(t-${holdEnd})/${slideOut},0))`;
      const bottomY = `if(lt(t,${slideIn}),${height}-${barH}*t/${slideIn},if(gt(t,${holdEnd}),${height - barH}+${barH}*(t-${holdEnd})/${slideOut},${height - barH}))`;
      
      let filter = `drawbox=x=0:y='${topY}':w=${width}:h=${barH}:color=${hexToFFmpeg(config.barColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawbox=x=0:y='${bottomY}':w=${width}:h=${barH}:color=${hexToFFmpeg(config.barColor as string)}:t=fill:enable='lte(t,${total})'`;
      
      // Add top text if provided
      if (config.topText) {
        filter += `,drawtext=text='${escapeFFmpegText(config.topText as string)}':fontsize=24:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
          `x=(w-text_w)/2:y=${barH/2 - 12}:enable='between(t,${slideIn},${holdEnd + slideOut * 0.5})'`;
      }
      
      // Add bottom text if provided  
      if (config.bottomText) {
        filter += `,drawtext=text='${escapeFFmpegText(config.bottomText as string)}':fontsize=24:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
          `x=(w-text_w)/2:y=${height - barH/2 - 12}:enable='between(t,${slideIn},${holdEnd + slideOut * 0.5})'`;
      }
      
      return filter;
    },
  },

  {
    id: "corner-accents",
    name: "Corner Accents",
    description: "Decorative L-shaped corners that frame the video",
    category: "frame",
    aiUsage: "Use to add a professional, branded frame to important moments or throughout the video for consistency.",
    aiTextFields: [],
    previewCss: `
      .corner { position: absolute; width: 60px; height: 60px; border: 4px solid var(--accent); }
      .tl { top: 40px; left: 40px; border-right: none; border-bottom: none; }
      .tr { top: 40px; right: 40px; border-left: none; border-bottom: none; }
      .bl { bottom: 40px; left: 40px; border-right: none; border-top: none; }
      .br { bottom: 40px; right: 40px; border-left: none; border-top: none; }
    `,
    defaultTiming: { slideIn: 0.3, hold: 0, slideOut: 0.3 },
    properties: [
      { key: "cornerColor", label: "Corner Color", type: "color", default: "#ff7f50", useBrandColor: "accent" },
      { key: "cornerSize", label: "Size", type: "number", default: 60, min: 30, max: 120 },
      { key: "margin", label: "Margin", type: "number", default: 40, min: 20, max: 100 },
      { key: "thickness", label: "Thickness", type: "number", default: 4, min: 2, max: 10 },
    ],
    generateFilter: (config, { width, height }) => {
      const size = (config.cornerSize as number) || 60;
      const m = (config.margin as number) || 40;
      const t = (config.thickness as number) || 4;
      const color = hexToFFmpeg(config.cornerColor as string);
      const slideIn = config.slideIn as number || 0.3;
      const holdEnd = slideIn + (config.hold as number || 0);
      const total = holdEnd + (config.slideOut as number || 0.3);
      
      // Draw L-shapes in each corner
      return [
        // Top-left
        `drawbox=x=${m}:y=${m}:w=${size}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${m}:w=${t}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
        // Top-right
        `drawbox=x=${width - m - size}:y=${m}:w=${size}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${width - m - t}:y=${m}:w=${t}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
        // Bottom-left
        `drawbox=x=${m}:y=${height - m - t}:w=${size}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${height - m - size}:w=${t}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
        // Bottom-right
        `drawbox=x=${width - m - size}:y=${height - m - t}:w=${size}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${width - m - t}:y=${height - m - size}:w=${t}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
      ].join(',');
    },
  },

  {
    id: "border-glow",
    name: "Border Glow",
    description: "Glowing border around the entire video frame",
    category: "frame",
    aiUsage: "Use for highlighting important sections, creating emphasis, or adding a futuristic/tech feel.",
    aiTextFields: [],
    previewCss: `
      .effect { position: absolute; inset: 20px; border: 3px solid var(--primary); 
                box-shadow: 0 0 20px var(--primary), inset 0 0 20px var(--primary); }
    `,
    defaultTiming: { slideIn: 0.5, hold: 0, slideOut: 0.5 },
    properties: [
      { key: "borderColor", label: "Border Color", type: "color", default: "#00f0ff", useBrandColor: "primary" },
      { key: "thickness", label: "Thickness", type: "number", default: 4, min: 2, max: 10 },
      { key: "margin", label: "Margin", type: "number", default: 20, min: 10, max: 50 },
    ],
    generateFilter: (config, { width, height }) => {
      const t = (config.thickness as number) || 4;
      const m = (config.margin as number) || 20;
      const color = hexToFFmpeg(config.borderColor as string);
      const slideIn = config.slideIn as number || 0.5;
      const holdEnd = slideIn + (config.hold as number || 0);
      const total = holdEnd + (config.slideOut as number || 0.5);
      
      return [
        `drawbox=x=${m}:y=${m}:w=${width - 2*m}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${height - m - t}:w=${width - 2*m}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${m}:w=${t}:h=${height - 2*m}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${width - m - t}:y=${m}:w=${t}:h=${height - 2*m}:color=${color}:t=fill:enable='lte(t,${total})'`,
      ].join(',');
    },
  },
];

// Get effects by category
export function getEffectsByCategory(category: EffectCategory): EffectTemplate[] {
  return EFFECT_TEMPLATES.filter(e => e.category === category);
}

// Get effect by ID
export function getEffectById(id: string): EffectTemplate | undefined {
  return EFFECT_TEMPLATES.find(e => e.id === id);
}

// Get all categories with counts
export function getEffectCategories(): { category: EffectCategory; count: number; label: string }[] {
  const labels: Record<EffectCategory, string> = {
    lower_third: "Lower Thirds",
    shape_overlay: "Shape Overlays",
    frame: "Frames/Borders",
  };
  
  const counts = new Map<EffectCategory, number>();
  EFFECT_TEMPLATES.forEach(e => {
    counts.set(e.category, (counts.get(e.category) || 0) + 1);
  });
  
  return Object.entries(labels).map(([category, label]) => ({
    category: category as EffectCategory,
    count: counts.get(category as EffectCategory) || 0,
    label,
  })).filter(c => c.count > 0);
}

// ============================================================================
// AI EFFECT SELECTION HELPERS
// ============================================================================

/**
 * Get effects suitable for AI selection with their usage hints
 * AI will use the aiUsage field to decide when to apply each effect
 */
export function getEffectsForAI(): Array<{
  id: string;
  name: string;
  usage: string;
  textFields: string[];
  defaultDuration: number;
}> {
  return EFFECT_TEMPLATES.map(e => ({
    id: e.id,
    name: e.name,
    usage: e.aiUsage,
    textFields: e.aiTextFields,
    defaultDuration: e.defaultTiming.slideIn + e.defaultTiming.hold + e.defaultTiming.slideOut,
  }));
}

/**
 * Apply brand colors to effect config
 * Called before rendering to ensure user's brand colors are used
 */
export function applyBrandColors(
  effectId: string, 
  config: EffectConfig, 
  brandColors: { primary: string; secondary: string; accent: string }
): EffectConfig {
  const effect = getEffectById(effectId);
  if (!effect) return config;
  
  const result = { ...config };
  
  effect.properties.forEach(prop => {
    if (prop.useBrandColor && !config[prop.key]) {
      // Apply brand color if not already set
      result[prop.key] = brandColors[prop.useBrandColor];
    } else if (prop.useBrandColor && config[prop.key] === prop.default) {
      // Override default with brand color
      result[prop.key] = brandColors[prop.useBrandColor];
    }
  });
  
  return result;
}

/**
 * Create effect config from AI-generated text
 * System generates the effect, AI only provides text content
 */
export function createEffectFromAI(
  effectId: string,
  aiText: { header?: string; body?: string; topText?: string; bottomText?: string },
  brandColors: { primary: string; secondary: string; accent: string },
  overrides?: { accentColor?: string }
): EffectConfig | null {
  const effect = getEffectById(effectId);
  if (!effect) return null;
  
  // Start with defaults
  const config: EffectConfig = {};
  effect.properties.forEach(prop => {
    config[prop.key] = prop.default;
  });
  
  // Add timing
  config.slideIn = effect.defaultTiming.slideIn;
  config.hold = effect.defaultTiming.hold;
  config.slideOut = effect.defaultTiming.slideOut;
  
  // Apply brand colors
  effect.properties.forEach(prop => {
    if (prop.useBrandColor) {
      config[prop.key] = overrides?.accentColor || brandColors[prop.useBrandColor];
    }
  });
  
  // Apply AI-generated text
  if (aiText.header !== undefined) config.header = aiText.header;
  if (aiText.body !== undefined) config.body = aiText.body;
  if (aiText.topText !== undefined) config.topText = aiText.topText;
  if (aiText.bottomText !== undefined) config.bottomText = aiText.bottomText;
  
  return config;
}
