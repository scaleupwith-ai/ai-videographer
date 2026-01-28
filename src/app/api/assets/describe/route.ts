import { NextRequest, NextResponse } from "next/server";

/**
 * Quick description endpoint - DEPRECATED
 * Video analysis now uses TwelveLabs via video jobs
 * This endpoint is kept for backwards compatibility but directs users to the new flow
 */
export async function POST(request: NextRequest) {
  // Check if we have TwelveLabs configured
  const hasTwelveLabs = !!process.env.TWELVELABS_API_KEY;
  
  if (!hasTwelveLabs) {
    console.log("No AI service configured for descriptions");
    return NextResponse.json({ 
      error: "AI description service not configured. Please enter description manually or configure TWELVELABS_API_KEY." 
    }, { status: 503 });
  }
  
  // Direct users to use the new video analysis flow
  return NextResponse.json({ 
    error: "Quick descriptions have been replaced with TwelveLabs video analysis. Upload your video and click 'Analyze Video' in the asset details for AI-powered analysis." 
  }, { status: 400 });
}
