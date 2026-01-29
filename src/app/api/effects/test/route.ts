import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuid } from "uuid";

interface SlideInShapeConfig {
  boxColor: string;
  boxWidth: number;
  slideDirection: "left" | "right";
  slideInDuration: number;
  holdDuration: number;
  slideOutDuration: number;
  text: string;
  textColor: string;
  fontSize: number;
  textFont: string;
}

/**
 * Generate FFmpeg filter for slide-in shape overlay
 * 
 * The animation has 3 phases:
 * 1. Slide in (0 to slideInDuration)
 * 2. Hold (slideInDuration to slideInDuration + holdDuration)
 * 3. Slide out (slideInDuration + holdDuration to end)
 */
function generateSlideInShapeFilter(config: SlideInShapeConfig, width: number, height: number): string {
  const {
    boxColor,
    boxWidth,
    slideDirection,
    slideInDuration,
    holdDuration,
    slideOutDuration,
    text,
    textColor,
    fontSize,
  } = config;

  const boxWidthPx = Math.round(width * boxWidth / 100);
  const holdEnd = slideInDuration + holdDuration;
  const totalDuration = holdEnd + slideOutDuration;

  // Convert hex colors to FFmpeg format (0xRRGGBB)
  const ffmpegBoxColor = boxColor.replace('#', '0x');
  const ffmpegTextColor = textColor.replace('#', '0x');

  // Calculate X position based on slide direction
  // For right: starts at W (off screen right), slides to W - boxWidth
  // For left: starts at -boxWidth (off screen left), slides to 0
  let xExpression: string;
  
  if (slideDirection === "right") {
    // Slide in from right edge
    // Phase 1 (slide in): x goes from W to W - boxWidth
    // Phase 2 (hold): x stays at W - boxWidth
    // Phase 3 (slide out): x goes from W - boxWidth back to W
    xExpression = `if(lt(t\\,${slideInDuration})\\,` +
      `${width}-${boxWidthPx}*t/${slideInDuration}\\,` +
      `if(gt(t\\,${holdEnd})\\,` +
      `${width}-${boxWidthPx}+${boxWidthPx}*(t-${holdEnd})/${slideOutDuration}\\,` +
      `${width}-${boxWidthPx}))`;
  } else {
    // Slide in from left edge
    // Phase 1 (slide in): x goes from -boxWidth to 0
    // Phase 2 (hold): x stays at 0
    // Phase 3 (slide out): x goes from 0 back to -boxWidth
    xExpression = `if(lt(t\\,${slideInDuration})\\,` +
      `-${boxWidthPx}+${boxWidthPx}*t/${slideInDuration}\\,` +
      `if(gt(t\\,${holdEnd})\\,` +
      `-${boxWidthPx}*(t-${holdEnd})/${slideOutDuration}\\,` +
      `0))`;
  }

  // Text position (centered in the box)
  const textX = slideDirection === "right" 
    ? `${width}-${boxWidthPx}/2-text_w/2` 
    : `${boxWidthPx}/2-text_w/2`;
  const textY = `(${height}-text_h)/2`;

  // Escape text for FFmpeg
  const escapedText = text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");

  // Build the filter chain
  const filters = [
    // Draw the box with animated position
    `drawbox=x='${xExpression}':y=0:w=${boxWidthPx}:h=${height}:color=${ffmpegBoxColor}:t=fill:enable='lte(t\\,${totalDuration})'`,
    // Draw the text (only visible during hold phase, but we show it slightly after slide-in completes)
    `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${ffmpegTextColor}:` +
      `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
      `x=${textX}:y=${textY}:` +
      `enable='between(t\\,${slideInDuration * 0.5}\\,${holdEnd + slideOutDuration * 0.5})'`,
  ];

  return filters.join(",");
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { effect, config } = body as { effect: string; config: SlideInShapeConfig };

    if (effect !== "slide-in-shape") {
      return NextResponse.json({ error: "Unknown effect type" }, { status: 400 });
    }

    // For now, return a mock response with the filter details
    // In production, this would render a test video using FFmpeg
    const width = 1920;
    const height = 1080;
    const filter = generateSlideInShapeFilter(config, width, height);
    const totalDuration = config.slideInDuration + config.holdDuration + config.slideOutDuration;

    console.log("[Effects Test] Generated filter:", filter);

    // For testing, we'll return a placeholder
    // In production, this would call the render worker to generate a preview
    return NextResponse.json({
      success: true,
      effect,
      filter,
      duration: totalDuration,
      message: "Filter generated successfully. Full render coming soon.",
      // Mock preview URL - in production, render to a real video
      previewUrl: null,
      filterExplanation: {
        boxFilter: `Draws a ${config.boxWidth}% width box that slides ${config.slideDirection === "right" ? "in from right" : "in from left"}`,
        timing: {
          slideIn: `0 - ${config.slideInDuration}s`,
          hold: `${config.slideInDuration}s - ${config.slideInDuration + config.holdDuration}s`,
          slideOut: `${config.slideInDuration + config.holdDuration}s - ${totalDuration}s`,
        },
      },
    });
  } catch (error) {
    console.error("Effects test error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate effect" },
      { status: 500 }
    );
  }
}

