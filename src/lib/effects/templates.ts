/**
 * Video Effect Templates
 * 
 * Each effect is implemented using FFmpeg filters.
 * All effects support customization via brand colors from user settings.
 * 
 * Timing parameters:
 * - slideInDuration: How long the element takes to appear
 * - holdDuration: How long the element stays visible
 * - slideOutDuration: How long the element takes to disappear
 */

export type EffectCategory = 
  | "lower_third"      // Name/title displays at bottom
  | "callout"          // Highlight/call attention to something
  | "transition"       // Between-scene effects
  | "text_overlay"     // General text on screen
  | "shape_overlay"    // Geometric shapes
  | "progress"         // Progress bars, timers
  | "social"           // Social media CTAs
  | "highlight"        // Emphasis effects
  | "split_screen"     // Screen divisions
  | "frame"            // Borders and frames

export interface EffectTemplate {
  id: string;
  name: string;
  description: string;
  category: EffectCategory;
  previewCss: string; // CSS for live preview in browser
  
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
}

export interface EffectConfig {
  [key: string]: string | number | boolean;
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
// EFFECT TEMPLATES
// ============================================================================

export const EFFECT_TEMPLATES: EffectTemplate[] = [
  // ========== LOWER THIRDS ==========
  {
    id: "lower-third-slide-box",
    name: "Lower Third - Slide Box",
    description: "Box slides in from side with header and body text",
    category: "lower_third",
    previewCss: `
      .effect { position: absolute; bottom: 10%; left: 0; }
      .box { background: var(--primary); padding: 16px 32px; }
      .header { font-size: 24px; font-weight: bold; color: white; }
      .body { font-size: 16px; color: rgba(255,255,255,0.8); margin-top: 4px; }
    `,
    defaultTiming: { slideIn: 0.5, hold: 4, slideOut: 0.5 },
    properties: [
      { key: "header", label: "Header Text", type: "text", default: "John Smith" },
      { key: "body", label: "Body Text", type: "text", default: "CEO & Founder" },
      { key: "boxColor", label: "Box Color", type: "color", default: "#00f0ff" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
      { key: "slideFrom", label: "Slide From", type: "select", default: "left", options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]},
      { key: "boxWidth", label: "Box Width %", type: "number", default: 35, min: 20, max: 60 },
    ],
    generateFilter: (config, { width, height }) => {
      const boxW = Math.round(width * (config.boxWidth as number) / 100);
      const boxH = 120;
      const boxY = height - boxH - 80; // 80px from bottom
      const slideIn = 0.5;
      const holdEnd = slideIn + (config.hold as number || 4);
      const slideOut = 0.5;
      const total = holdEnd + slideOut;
      
      const fromLeft = config.slideFrom === "left";
      const xExpr = fromLeft
        ? `if(lt(t,${slideIn}),-${boxW}+${boxW}*t/${slideIn},if(gt(t,${holdEnd}),${boxW}*(1-(t-${holdEnd})/${slideOut})-${boxW},0))`
        : `if(lt(t,${slideIn}),${width}-${boxW}*t/${slideIn},if(gt(t,${holdEnd}),${width}-${boxW}+${boxW}*(t-${holdEnd})/${slideOut},${width}-${boxW}))`;
      
      return `drawbox=x='${xExpr}':y=${boxY}:w=${boxW}:h=${boxH}:color=${hexToFFmpeg(config.boxColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.header as string)}':fontsize=36:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=${fromLeft ? boxW/2 - 100 : width - boxW/2 - 100}:y=${boxY + 25}:enable='between(t,${slideIn * 0.8},${holdEnd + slideOut * 0.2})',` +
        `drawtext=text='${escapeFFmpegText(config.body as string)}':fontsize=24:fontcolor=${hexToFFmpeg(config.textColor as string)}@0.8:` +
        `x=${fromLeft ? boxW/2 - 100 : width - boxW/2 - 100}:y=${boxY + 70}:enable='between(t,${slideIn * 0.8},${holdEnd + slideOut * 0.2})'`;
    },
  },

  {
    id: "lower-third-minimal",
    name: "Lower Third - Minimal Line",
    description: "Clean minimal style with animated underline",
    category: "lower_third",
    previewCss: `
      .effect { position: absolute; bottom: 12%; left: 5%; }
      .header { font-size: 28px; font-weight: 600; color: white; }
      .line { width: 0; height: 3px; background: var(--accent); margin-top: 8px; animation: grow 0.5s forwards; }
      @keyframes grow { to { width: 200px; } }
      .body { font-size: 18px; color: rgba(255,255,255,0.7); margin-top: 8px; }
    `,
    defaultTiming: { slideIn: 0.4, hold: 4, slideOut: 0.3 },
    properties: [
      { key: "header", label: "Header", type: "text", default: "Featured Speaker" },
      { key: "body", label: "Subtitle", type: "text", default: "Marketing Director" },
      { key: "lineColor", label: "Line Color", type: "color", default: "#ff7f50" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
    ],
    generateFilter: (config, { width, height }) => {
      const y = height - 180;
      const lineY = y + 45;
      const slideIn = 0.4;
      const holdEnd = slideIn + (config.hold as number || 4);
      const total = holdEnd + 0.3;
      
      const lineW = `if(lt(t,${slideIn}),300*t/${slideIn},if(gt(t,${holdEnd}),300*(1-(t-${holdEnd})/0.3),300))`;
      
      return `drawbox=x=100:y=${lineY}:w='${lineW}':h=4:color=${hexToFFmpeg(config.lineColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.header as string)}':fontsize=42:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=100:y=${y}:enable='between(t,${slideIn * 0.5},${holdEnd + 0.15})',` +
        `drawtext=text='${escapeFFmpegText(config.body as string)}':fontsize=28:fontcolor=${hexToFFmpeg(config.textColor as string)}@0.7:` +
        `x=100:y=${lineY + 20}:enable='between(t,${slideIn * 0.7},${holdEnd + 0.1})'`;
    },
  },

  {
    id: "lower-third-corner-badge",
    name: "Lower Third - Corner Badge",
    description: "Angled badge in bottom corner",
    category: "lower_third",
    previewCss: `
      .effect { position: absolute; bottom: 0; left: 0; }
      .badge { background: var(--primary); color: white; padding: 12px 48px 12px 24px; 
               clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 100%, 0 100%); }
    `,
    defaultTiming: { slideIn: 0.3, hold: 5, slideOut: 0.3 },
    properties: [
      { key: "text", label: "Text", type: "text", default: "LIVE" },
      { key: "bgColor", label: "Background", type: "color", default: "#e63946" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
    ],
    generateFilter: (config, { width, height }) => {
      const slideIn = 0.3;
      const holdEnd = slideIn + (config.hold as number || 5);
      const total = holdEnd + 0.3;
      const boxW = 200;
      const boxH = 50;
      
      const xExpr = `if(lt(t,${slideIn}),-${boxW}+${boxW}*t/${slideIn},if(gt(t,${holdEnd}),-${boxW}*(t-${holdEnd})/0.3,0))`;
      
      return `drawbox=x='${xExpr}':y=${height - boxH}:w=${boxW}:h=${boxH}:color=${hexToFFmpeg(config.bgColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=28:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=40:y=${height - boxH + 12}:enable='between(t,${slideIn * 0.5},${holdEnd + 0.15})'`;
    },
  },

  // ========== TEXT OVERLAYS ==========
  {
    id: "text-center-pop",
    name: "Center Text - Pop",
    description: "Text pops in at center with scale animation",
    category: "text_overlay",
    previewCss: `
      .effect { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
      .text { font-size: 64px; font-weight: bold; color: white; text-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    `,
    defaultTiming: { slideIn: 0.2, hold: 3, slideOut: 0.2 },
    properties: [
      { key: "text", label: "Text", type: "text", default: "BREAKING NEWS" },
      { key: "textColor", label: "Color", type: "color", default: "#ffffff" },
      { key: "fontSize", label: "Font Size", type: "number", default: 72, min: 24, max: 200 },
    ],
    generateFilter: (config, { width, height }) => {
      const slideIn = 0.2;
      const holdEnd = slideIn + (config.hold as number || 3);
      const total = holdEnd + 0.2;
      
      return `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=${config.fontSize}:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,${total})'`;
    },
  },

  {
    id: "text-typewriter",
    name: "Typewriter Text",
    description: "Text appears letter by letter",
    category: "text_overlay",
    previewCss: `
      .effect { position: absolute; bottom: 20%; left: 50%; transform: translateX(-50%); }
      .text { font-family: monospace; font-size: 32px; color: #00ff00; }
    `,
    defaultTiming: { slideIn: 2, hold: 2, slideOut: 0.3 },
    properties: [
      { key: "text", label: "Text", type: "text", default: "Loading complete..." },
      { key: "textColor", label: "Color", type: "color", default: "#00ff00" },
    ],
    generateFilter: (config, { width, height }) => {
      // FFmpeg doesn't easily support typewriter, so we show the text after slideIn
      const slideIn = 2;
      const holdEnd = slideIn + (config.hold as number || 2);
      const total = holdEnd + 0.3;
      
      return `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=40:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=(w-text_w)/2:y=${height - 200}:enable='between(t,${slideIn},${total})'`;
    },
  },

  // ========== SHAPE OVERLAYS ==========
  {
    id: "shape-slide-box",
    name: "Slide-in Box",
    description: "Colored box slides in from side with text",
    category: "shape_overlay",
    previewCss: `
      .effect { position: absolute; top: 0; right: 0; width: 50%; height: 100%; background: var(--primary); }
      .text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
              font-size: 48px; font-weight: bold; color: white; }
    `,
    defaultTiming: { slideIn: 0.5, hold: 5, slideOut: 0.5 },
    properties: [
      { key: "header", label: "Header", type: "text", default: "AGENDA" },
      { key: "body", label: "Body", type: "text", default: "What we will cover today" },
      { key: "boxColor", label: "Box Color", type: "color", default: "#ff7f50" },
      { key: "textColor", label: "Text Color", type: "color", default: "#000000" },
      { key: "boxWidth", label: "Width %", type: "number", default: 50, min: 30, max: 70 },
      { key: "slideFrom", label: "Direction", type: "select", default: "right", options: [
        { value: "left", label: "From Left" },
        { value: "right", label: "From Right" },
      ]},
    ],
    generateFilter: (config, { width, height }) => {
      const boxW = Math.round(width * (config.boxWidth as number) / 100);
      const slideIn = 0.5;
      const holdEnd = slideIn + (config.hold as number || 5);
      const slideOut = 0.5;
      const total = holdEnd + slideOut;
      
      const fromRight = config.slideFrom === "right";
      let xExpr: string;
      if (fromRight) {
        xExpr = `if(lt(t,${slideIn}),${width}-${boxW}*t/${slideIn},if(gt(t,${holdEnd}),${width}-${boxW}+${boxW}*(t-${holdEnd})/${slideOut},${width}-${boxW}))`;
      } else {
        xExpr = `if(lt(t,${slideIn}),-${boxW}+${boxW}*t/${slideIn},if(gt(t,${holdEnd}),${boxW}*(1-(t-${holdEnd})/${slideOut})-${boxW},0))`;
      }
      
      const textX = fromRight ? width - boxW/2 : boxW/2;
      
      return `drawbox=x='${xExpr}':y=0:w=${boxW}:h=${height}:color=${hexToFFmpeg(config.boxColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.header as string)}':fontsize=72:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=${textX}-text_w/2:y=${height/2 - 60}:enable='between(t,${slideIn * 0.5},${holdEnd + slideOut * 0.5})',` +
        `drawtext=text='${escapeFFmpegText(config.body as string)}':fontsize=36:fontcolor=${hexToFFmpeg(config.textColor as string)}@0.8:` +
        `x=${textX}-text_w/2:y=${height/2 + 20}:enable='between(t,${slideIn * 0.7},${holdEnd + slideOut * 0.3})'`;
    },
  },

  {
    id: "shape-circle-reveal",
    name: "Circle Focus",
    description: "Dark vignette with bright circle highlighting center",
    category: "shape_overlay",
    previewCss: `
      .effect { position: absolute; inset: 0; background: radial-gradient(circle, transparent 30%, rgba(0,0,0,0.7) 70%); }
    `,
    defaultTiming: { slideIn: 0.5, hold: 3, slideOut: 0.5 },
    properties: [
      { key: "intensity", label: "Darkness", type: "number", default: 0.7, min: 0.3, max: 0.9 },
    ],
    generateFilter: (config) => {
      const slideIn = 0.5;
      const holdEnd = slideIn + (config.hold as number || 3);
      const total = holdEnd + 0.5;
      const alpha = `if(lt(t,${slideIn}),${config.intensity}*t/${slideIn},if(gt(t,${holdEnd}),${config.intensity}*(1-(t-${holdEnd})/0.5),${config.intensity}))`;
      
      return `vignette=mode=forward:angle=PI/4:x0=0.5:y0=0.5:enable='lte(t,${total})'`;
    },
  },

  {
    id: "shape-top-banner",
    name: "Top Banner",
    description: "Full-width banner at top of screen",
    category: "shape_overlay",
    previewCss: `
      .effect { position: absolute; top: 0; left: 0; right: 0; height: 80px; background: var(--primary); }
      .text { line-height: 80px; text-align: center; color: white; font-size: 28px; font-weight: bold; }
    `,
    defaultTiming: { slideIn: 0.3, hold: 5, slideOut: 0.3 },
    properties: [
      { key: "text", label: "Banner Text", type: "text", default: "🔴 LIVE BROADCAST" },
      { key: "bgColor", label: "Background", type: "color", default: "#e63946" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
      { key: "height", label: "Height", type: "number", default: 80, min: 50, max: 150 },
    ],
    generateFilter: (config, { width }) => {
      const h = config.height as number;
      const slideIn = 0.3;
      const holdEnd = slideIn + (config.hold as number || 5);
      const total = holdEnd + 0.3;
      
      const yExpr = `if(lt(t,${slideIn}),-${h}+${h}*t/${slideIn},if(gt(t,${holdEnd}),-${h}*(t-${holdEnd})/0.3,0))`;
      
      return `drawbox=x=0:y='${yExpr}':w=${width}:h=${h}:color=${hexToFFmpeg(config.bgColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=36:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=(w-text_w)/2:y=${h/2 - 18}:enable='between(t,${slideIn * 0.5},${holdEnd + 0.15})'`;
    },
  },

  {
    id: "shape-bottom-ticker",
    name: "Bottom Ticker",
    description: "News-style scrolling ticker at bottom",
    category: "shape_overlay",
    previewCss: `
      .effect { position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: var(--secondary); }
      .text { line-height: 60px; color: white; font-size: 24px; white-space: nowrap; animation: scroll 10s linear infinite; }
      @keyframes scroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
    `,
    defaultTiming: { slideIn: 0.3, hold: 8, slideOut: 0.3 },
    properties: [
      { key: "text", label: "Ticker Text", type: "text", default: "Breaking: Important news update • Stay tuned for more information • Subscribe for updates" },
      { key: "bgColor", label: "Background", type: "color", default: "#1a1a2e" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
    ],
    generateFilter: (config, { width, height }) => {
      const h = 60;
      const y = height - h;
      const slideIn = 0.3;
      const holdEnd = slideIn + (config.hold as number || 8);
      const total = holdEnd + 0.3;
      
      // Scrolling text - x position moves from right to left
      const scrollDuration = total - slideIn;
      const xExpr = `${width}-mod(t-${slideIn},${scrollDuration})/${scrollDuration}*(${width}+text_w*2)`;
      
      return `drawbox=x=0:y=${y}:w=${width}:h=${h}:color=${hexToFFmpeg(config.bgColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=28:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x='${xExpr}':y=${y + 16}:enable='between(t,${slideIn},${total})'`;
    },
  },

  // ========== CALLOUTS ==========
  {
    id: "callout-arrow-left",
    name: "Arrow Callout - Left",
    description: "Arrow pointing left with text box",
    category: "callout",
    previewCss: `
      .effect { position: absolute; top: 40%; right: 20%; display: flex; align-items: center; }
      .arrow { width: 0; height: 0; border-top: 20px solid transparent; border-bottom: 20px solid transparent; 
               border-right: 30px solid var(--primary); margin-right: 8px; }
      .box { background: var(--primary); padding: 12px 24px; color: white; font-weight: bold; }
    `,
    defaultTiming: { slideIn: 0.3, hold: 4, slideOut: 0.3 },
    properties: [
      { key: "text", label: "Text", type: "text", default: "Look here!" },
      { key: "color", label: "Color", type: "color", default: "#00f0ff" },
      { key: "posX", label: "X Position %", type: "number", default: 70, min: 20, max: 90 },
      { key: "posY", label: "Y Position %", type: "number", default: 40, min: 10, max: 80 },
    ],
    generateFilter: (config, { width, height }) => {
      const x = Math.round(width * (config.posX as number) / 100);
      const y = Math.round(height * (config.posY as number) / 100);
      const slideIn = 0.3;
      const holdEnd = slideIn + (config.hold as number || 4);
      const total = holdEnd + 0.3;
      
      return `drawbox=x=${x}:y=${y - 25}:w=200:h=50:color=${hexToFFmpeg(config.color as string)}:t=fill:enable='between(t,${slideIn},${total})',` +
        `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=24:fontcolor=white:` +
        `x=${x + 15}:y=${y - 12}:enable='between(t,${slideIn},${total})'`;
    },
  },

  {
    id: "callout-highlight-box",
    name: "Highlight Box",
    description: "Rectangular highlight box that pulses",
    category: "callout",
    previewCss: `
      .effect { position: absolute; top: 30%; left: 30%; width: 200px; height: 100px; 
                border: 4px solid var(--accent); animation: pulse 1s infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    `,
    defaultTiming: { slideIn: 0.2, hold: 3, slideOut: 0.2 },
    properties: [
      { key: "borderColor", label: "Border Color", type: "color", default: "#ff7f50" },
      { key: "posX", label: "X Position %", type: "number", default: 50, min: 10, max: 90 },
      { key: "posY", label: "Y Position %", type: "number", default: 50, min: 10, max: 90 },
      { key: "boxWidth", label: "Width", type: "number", default: 200, min: 100, max: 500 },
      { key: "boxHeight", label: "Height", type: "number", default: 100, min: 50, max: 300 },
    ],
    generateFilter: (config, { width, height }) => {
      const x = Math.round(width * (config.posX as number) / 100) - (config.boxWidth as number) / 2;
      const y = Math.round(height * (config.posY as number) / 100) - (config.boxHeight as number) / 2;
      const w = config.boxWidth as number;
      const h = config.boxHeight as number;
      const slideIn = 0.2;
      const holdEnd = slideIn + (config.hold as number || 3);
      const total = holdEnd + 0.2;
      
      // Draw 4 sides of a rectangle (border effect)
      return `drawbox=x=${x}:y=${y}:w=${w}:h=4:color=${hexToFFmpeg(config.borderColor as string)}:t=fill:enable='between(t,0,${total})',` +
        `drawbox=x=${x}:y=${y + h - 4}:w=${w}:h=4:color=${hexToFFmpeg(config.borderColor as string)}:t=fill:enable='between(t,0,${total})',` +
        `drawbox=x=${x}:y=${y}:w=4:h=${h}:color=${hexToFFmpeg(config.borderColor as string)}:t=fill:enable='between(t,0,${total})',` +
        `drawbox=x=${x + w - 4}:y=${y}:w=4:h=${h}:color=${hexToFFmpeg(config.borderColor as string)}:t=fill:enable='between(t,0,${total})'`;
    },
  },

  // ========== PROGRESS ==========
  {
    id: "progress-bar-bottom",
    name: "Progress Bar",
    description: "Animated progress bar at bottom of screen",
    category: "progress",
    previewCss: `
      .effect { position: absolute; bottom: 0; left: 0; right: 0; height: 8px; background: rgba(255,255,255,0.2); }
      .bar { height: 100%; background: var(--primary); width: 0; animation: progress 5s linear forwards; }
      @keyframes progress { to { width: 100%; } }
    `,
    defaultTiming: { slideIn: 0, hold: 10, slideOut: 0.2 },
    properties: [
      { key: "barColor", label: "Bar Color", type: "color", default: "#00f0ff" },
      { key: "bgColor", label: "Background", type: "color", default: "#333333" },
      { key: "height", label: "Height", type: "number", default: 8, min: 4, max: 20 },
    ],
    generateFilter: (config, { width, height }) => {
      const h = config.height as number;
      const y = height - h;
      const duration = config.hold as number || 10;
      
      // Progress fills from 0 to full width over duration
      const progressW = `${width}*t/${duration}`;
      
      return `drawbox=x=0:y=${y}:w=${width}:h=${h}:color=${hexToFFmpeg(config.bgColor as string)}:t=fill:enable='lte(t,${duration})',` +
        `drawbox=x=0:y=${y}:w='${progressW}':h=${h}:color=${hexToFFmpeg(config.barColor as string)}:t=fill:enable='lte(t,${duration})'`;
    },
  },

  {
    id: "progress-countdown",
    name: "Countdown Timer",
    description: "Circular countdown timer overlay",
    category: "progress",
    previewCss: `
      .effect { position: absolute; top: 20px; right: 20px; width: 80px; height: 80px; 
                border: 4px solid var(--primary); border-radius: 50%; display: flex; 
                align-items: center; justify-content: center; font-size: 32px; color: white; }
    `,
    defaultTiming: { slideIn: 0.2, hold: 10, slideOut: 0.2 },
    properties: [
      { key: "startNumber", label: "Start From", type: "number", default: 10, min: 3, max: 60 },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
      { key: "bgColor", label: "Background", type: "color", default: "#000000" },
    ],
    generateFilter: (config, { width }) => {
      const start = config.startNumber as number;
      const x = width - 100;
      const y = 20;
      
      // Show countdown number
      const countExpr = `${start}-floor(t)`;
      
      return `drawbox=x=${x}:y=${y}:w=80:h=80:color=${hexToFFmpeg(config.bgColor as string)}@0.7:t=fill:enable='lte(t,${start})',` +
        `drawtext=text='%{eif\\:${countExpr}\\:d}':fontsize=48:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=${x + 25}:y=${y + 15}:enable='lte(t,${start})'`;
    },
  },

  // ========== SOCIAL ==========
  {
    id: "social-subscribe-button",
    name: "Subscribe Button",
    description: "YouTube-style subscribe button animation",
    category: "social",
    previewCss: `
      .effect { position: absolute; bottom: 15%; right: 10%; }
      .button { background: #ff0000; color: white; padding: 12px 24px; border-radius: 4px; 
                font-weight: bold; display: flex; align-items: center; gap: 8px; }
      .icon { width: 24px; height: 24px; }
    `,
    defaultTiming: { slideIn: 0.4, hold: 4, slideOut: 0.4 },
    properties: [
      { key: "text", label: "Button Text", type: "text", default: "SUBSCRIBE" },
      { key: "bgColor", label: "Background", type: "color", default: "#ff0000" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
    ],
    generateFilter: (config, { width, height }) => {
      const btnW = 200;
      const btnH = 50;
      const x = width - btnW - 100;
      const y = height - 200;
      const slideIn = 0.4;
      const holdEnd = slideIn + (config.hold as number || 4);
      const total = holdEnd + 0.4;
      
      // Slide up animation
      const yExpr = `if(lt(t,${slideIn}),${height}-(${height}-${y})*t/${slideIn},if(gt(t,${holdEnd}),${y}+(${height}-${y})*(t-${holdEnd})/0.4,${y}))`;
      
      return `drawbox=x=${x}:y='${yExpr}':w=${btnW}:h=${btnH}:color=${hexToFFmpeg(config.bgColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=24:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=${x + 40}:y='${yExpr}'+12:enable='lte(t,${total})'`;
    },
  },

  {
    id: "social-like-reminder",
    name: "Like Reminder",
    description: "Animated like button reminder",
    category: "social",
    previewCss: `
      .effect { position: absolute; bottom: 20%; left: 10%; display: flex; align-items: center; gap: 16px; }
      .icon { font-size: 48px; animation: bounce 0.5s ease infinite; }
      @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
      .text { color: white; font-size: 24px; }
    `,
    defaultTiming: { slideIn: 0.3, hold: 3, slideOut: 0.3 },
    properties: [
      { key: "text", label: "Text", type: "text", default: "Don't forget to like!" },
      { key: "textColor", label: "Text Color", type: "color", default: "#ffffff" },
    ],
    generateFilter: (config, { height }) => {
      const y = height - 250;
      const slideIn = 0.3;
      const holdEnd = slideIn + (config.hold as number || 3);
      const total = holdEnd + 0.3;
      
      return `drawtext=text='👍':fontsize=64:x=100:y=${y}:enable='between(t,${slideIn},${total})',` +
        `drawtext=text='${escapeFFmpegText(config.text as string)}':fontsize=32:fontcolor=${hexToFFmpeg(config.textColor as string)}:` +
        `x=180:y=${y + 15}:enable='between(t,${slideIn * 0.5},${total})'`;
    },
  },

  // ========== FRAMES ==========
  {
    id: "frame-letterbox",
    name: "Letterbox Bars",
    description: "Cinematic letterbox bars top and bottom",
    category: "frame",
    previewCss: `
      .bar-top { position: absolute; top: 0; left: 0; right: 0; height: 12%; background: black; }
      .bar-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 12%; background: black; }
    `,
    defaultTiming: { slideIn: 0.5, hold: 0, slideOut: 0.5 },
    properties: [
      { key: "barHeight", label: "Bar Height %", type: "number", default: 12, min: 5, max: 20 },
      { key: "barColor", label: "Bar Color", type: "color", default: "#000000" },
    ],
    generateFilter: (config, { width, height }) => {
      const barH = Math.round(height * (config.barHeight as number) / 100);
      const slideIn = 0.5;
      const total = slideIn + (config.hold as number || 0) + 0.5;
      
      // Bars slide in from top/bottom
      const topY = `if(lt(t,${slideIn}),-${barH}+${barH}*t/${slideIn},0)`;
      const bottomY = `if(lt(t,${slideIn}),${height}-${barH}*t/${slideIn},${height - barH})`;
      
      return `drawbox=x=0:y='${topY}':w=${width}:h=${barH}:color=${hexToFFmpeg(config.barColor as string)}:t=fill:enable='lte(t,${total})',` +
        `drawbox=x=0:y='${bottomY}':w=${width}:h=${barH}:color=${hexToFFmpeg(config.barColor as string)}:t=fill:enable='lte(t,${total})'`;
    },
  },

  {
    id: "frame-corner-accents",
    name: "Corner Accents",
    description: "Decorative L-shaped corners",
    category: "frame",
    previewCss: `
      .corner { position: absolute; width: 60px; height: 60px; border: 4px solid var(--accent); }
      .tl { top: 40px; left: 40px; border-right: none; border-bottom: none; }
      .tr { top: 40px; right: 40px; border-left: none; border-bottom: none; }
      .bl { bottom: 40px; left: 40px; border-right: none; border-top: none; }
      .br { bottom: 40px; right: 40px; border-left: none; border-top: none; }
    `,
    defaultTiming: { slideIn: 0.3, hold: 0, slideOut: 0.3 },
    properties: [
      { key: "cornerColor", label: "Corner Color", type: "color", default: "#ff7f50" },
      { key: "cornerSize", label: "Size", type: "number", default: 60, min: 30, max: 120 },
      { key: "margin", label: "Margin", type: "number", default: 40, min: 20, max: 100 },
    ],
    generateFilter: (config, { width, height }) => {
      const size = config.cornerSize as number;
      const m = config.margin as number;
      const thickness = 4;
      const color = hexToFFmpeg(config.cornerColor as string);
      const total = 0.3 + (config.hold as number || 0) + 0.3;
      
      // Draw L-shapes in each corner
      return [
        // Top-left
        `drawbox=x=${m}:y=${m}:w=${size}:h=${thickness}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${m}:w=${thickness}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
        // Top-right
        `drawbox=x=${width - m - size}:y=${m}:w=${size}:h=${thickness}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${width - m - thickness}:y=${m}:w=${thickness}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
        // Bottom-left
        `drawbox=x=${m}:y=${height - m - thickness}:w=${size}:h=${thickness}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${height - m - size}:w=${thickness}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
        // Bottom-right
        `drawbox=x=${width - m - size}:y=${height - m - thickness}:w=${size}:h=${thickness}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${width - m - thickness}:y=${height - m - size}:w=${thickness}:h=${size}:color=${color}:t=fill:enable='lte(t,${total})'`,
      ].join(',');
    },
  },

  {
    id: "frame-border-glow",
    name: "Border Glow",
    description: "Glowing border around entire frame",
    category: "frame",
    previewCss: `
      .effect { position: absolute; inset: 20px; border: 3px solid var(--primary); 
                box-shadow: 0 0 20px var(--primary), inset 0 0 20px var(--primary); }
    `,
    defaultTiming: { slideIn: 0.5, hold: 0, slideOut: 0.5 },
    properties: [
      { key: "borderColor", label: "Border Color", type: "color", default: "#00f0ff" },
      { key: "thickness", label: "Thickness", type: "number", default: 4, min: 2, max: 10 },
      { key: "margin", label: "Margin", type: "number", default: 20, min: 10, max: 50 },
    ],
    generateFilter: (config, { width, height }) => {
      const t = config.thickness as number;
      const m = config.margin as number;
      const color = hexToFFmpeg(config.borderColor as string);
      const total = 0.5 + (config.hold as number || 0) + 0.5;
      
      return [
        `drawbox=x=${m}:y=${m}:w=${width - 2*m}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${height - m - t}:w=${width - 2*m}:h=${t}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${m}:y=${m}:w=${t}:h=${height - 2*m}:color=${color}:t=fill:enable='lte(t,${total})'`,
        `drawbox=x=${width - m - t}:y=${m}:w=${t}:h=${height - 2*m}:color=${color}:t=fill:enable='lte(t,${total})'`,
      ].join(',');
    },
  },

  // ========== SPLIT SCREEN ==========
  {
    id: "split-vertical-line",
    name: "Vertical Split Line",
    description: "Animated vertical divider line",
    category: "split_screen",
    previewCss: `
      .effect { position: absolute; top: 0; bottom: 0; left: 50%; width: 4px; background: var(--accent); }
    `,
    defaultTiming: { slideIn: 0.4, hold: 5, slideOut: 0.4 },
    properties: [
      { key: "lineColor", label: "Line Color", type: "color", default: "#ff7f50" },
      { key: "position", label: "Position %", type: "number", default: 50, min: 20, max: 80 },
    ],
    generateFilter: (config, { width, height }) => {
      const x = Math.round(width * (config.position as number) / 100);
      const slideIn = 0.4;
      const holdEnd = slideIn + (config.hold as number || 5);
      const total = holdEnd + 0.4;
      
      // Line grows from center
      const lineH = `if(lt(t,${slideIn}),${height}*t/${slideIn},if(gt(t,${holdEnd}),${height}*(1-(t-${holdEnd})/0.4),${height}))`;
      const lineY = `(${height}-${lineH})/2`;
      
      return `drawbox=x=${x - 2}:y='${lineY}':w=4:h='${lineH}':color=${hexToFFmpeg(config.lineColor as string)}:t=fill:enable='lte(t,${total})'`;
    },
  },

  // ========== HIGHLIGHT ==========
  {
    id: "highlight-flash",
    name: "Flash Highlight",
    description: "Quick white flash for emphasis",
    category: "highlight",
    previewCss: `
      .effect { position: absolute; inset: 0; background: white; animation: flash 0.3s ease-out; }
      @keyframes flash { from { opacity: 0.8; } to { opacity: 0; } }
    `,
    defaultTiming: { slideIn: 0.05, hold: 0.1, slideOut: 0.15 },
    properties: [
      { key: "flashColor", label: "Flash Color", type: "color", default: "#ffffff" },
      { key: "intensity", label: "Intensity", type: "number", default: 0.7, min: 0.3, max: 1 },
    ],
    generateFilter: (config, { width, height }) => {
      const total = 0.05 + 0.1 + 0.15;
      const alpha = `if(lt(t,0.05),${config.intensity}*t/0.05,if(lt(t,0.15),${config.intensity},${config.intensity}*(1-(t-0.15)/0.15)))`;
      
      return `drawbox=x=0:y=0:w=${width}:h=${height}:color=${hexToFFmpeg(config.flashColor as string)}@'${alpha}':t=fill:enable='lte(t,${total})'`;
    },
  },

  {
    id: "highlight-zoom-blur",
    name: "Zoom Blur",
    description: "Radial zoom blur effect",
    category: "highlight",
    previewCss: `
      .effect { position: absolute; inset: 0; background: radial-gradient(circle, transparent 0%, rgba(0,0,0,0.3) 100%); }
    `,
    defaultTiming: { slideIn: 0.3, hold: 2, slideOut: 0.3 },
    properties: [
      { key: "intensity", label: "Intensity", type: "number", default: 0.5, min: 0.2, max: 1 },
    ],
    generateFilter: () => {
      // Zoom blur using zoompan (simplified - real implementation would be more complex)
      return `vignette=mode=forward:angle=PI/4`;
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
    callout: "Callouts",
    transition: "Transitions",
    text_overlay: "Text Overlays",
    shape_overlay: "Shape Overlays",
    progress: "Progress/Timers",
    social: "Social Media",
    highlight: "Highlights",
    split_screen: "Split Screen",
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

