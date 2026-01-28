import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

/**
 * Fast Gemini Video Analysis API
 * 
 * Analyzes video content using Google's Gemini 2.0 Flash model.
 * Optimized for speed and returns structured scene analysis.
 * 
 * Features:
 * - Scene-by-scene breakdown with timestamps
 * - Action/emotion detection
 * - Keyword/tag extraction  
 * - B-roll suggestions
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface AnalyzeRequest {
  videoUrl?: string;        // Public URL (R2, S3, etc.)
  videoBase64?: string;     // Base64-encoded video data
  mimeType?: string;        // Required for base64 (e.g., "video/mp4")
  reference?: string;       // Product/location context
  analysisType?: "quick" | "detailed" | "scenes" | "tags";
}

interface SceneAnalysis {
  startTime: number;
  endTime: number;
  description: string;
  actions: string[];
  mood: string;
  suggestedBRoll?: string[];
}

interface AnalysisResult {
  name: string;
  description: string;
  tags: string[];
  keywords: string[];
  scenes: SceneAnalysis[];
  mainSubject: string;
  setting: string;
  overallMood: string;
  suggestedUseCases: string[];
}

// Optimized prompts for faster analysis
const QUICK_PROMPT = `Analyze this video quickly. Return JSON only:
{
  "name": "short title (max 50 chars)",
  "description": "2-3 sentence description",
  "tags": ["5-8 relevant tags"],
  "mainSubject": "what/who is the main focus",
  "setting": "location/environment type",
  "overallMood": "emotional tone"
}`;

const DETAILED_PROMPT = `Analyze this video in detail. For each distinct scene/shot, note the timestamp.

Return JSON only:
{
  "name": "short descriptive title (max 50 chars)",
  "description": "comprehensive 2-3 sentence description",
  "tags": ["8-12 relevant tags for categorization"],
  "keywords": ["important words/concepts shown"],
  "mainSubject": "primary focus of the video",
  "setting": "location/environment description",
  "overallMood": "emotional tone/atmosphere",
  "scenes": [
    {
      "startTime": 0,
      "endTime": 5,
      "description": "what happens in this scene",
      "actions": ["action1", "action2"],
      "mood": "scene mood",
      "suggestedBRoll": ["type of b-roll that would complement this"]
    }
  ],
  "suggestedUseCases": ["marketing", "tutorial", etc]
}`;

const SCENES_PROMPT = `Break down this video into individual scenes/shots with precise timestamps.

Return JSON only:
{
  "scenes": [
    {
      "startTime": 0,
      "endTime": 5.5,
      "description": "detailed scene description",
      "actions": ["action1", "action2"],
      "mood": "emotional tone",
      "visualElements": ["key visual elements"],
      "cameraMovement": "static/pan/zoom/etc"
    }
  ],
  "totalScenes": number,
  "transitions": ["cut", "fade", etc]
}`;

const TAGS_PROMPT = `Generate comprehensive tags for this video content.

Return JSON only:
{
  "subject": ["main subjects/people/objects"],
  "setting": ["location/environment tags"],
  "action": ["actions/activities shown"],
  "mood": ["emotional tones"],
  "style": ["visual style tags"],
  "industry": ["relevant industries"],
  "color": ["dominant colors"],
  "objects": ["notable objects"]
}`;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: AnalyzeRequest = await request.json();
    const { videoUrl, videoBase64, mimeType, reference, analysisType = "detailed" } = body;

    // Validate input
    if (!videoUrl && !videoBase64) {
      return NextResponse.json({ 
        error: "Either videoUrl or videoBase64 is required" 
      }, { status: 400 });
    }

    if (videoBase64 && !mimeType) {
      return NextResponse.json({ 
        error: "mimeType is required when using videoBase64" 
      }, { status: 400 });
    }

    // Use optimized Gemini 2.0 Flash model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        maxOutputTokens: analysisType === "quick" ? 1024 : 4096,
        temperature: 0.2, // Lower temp for more consistent structured output
      },
    });

    // Build content parts
    const parts: Part[] = [];

    // Add video part
    if (videoUrl) {
      console.log(`[Video Analysis] Fetching video from URL: ${videoUrl.substring(0, 50)}...`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout
        
        const videoResponse = await fetch(videoUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoResponse.status}`);
        }
        
        const videoBuffer = await videoResponse.arrayBuffer();
        const base64Data = Buffer.from(videoBuffer).toString("base64");
        const detectedMime = videoResponse.headers.get("content-type") || "video/mp4";
        
        const sizeMB = videoBuffer.byteLength / (1024 * 1024);
        console.log(`[Video Analysis] Video size: ${sizeMB.toFixed(2)}MB`);
        
        if (sizeMB > 20) {
          return NextResponse.json({ 
            error: "Video too large. Maximum size is 20MB for analysis." 
          }, { status: 400 });
        }
        
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: detectedMime,
          },
        });
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return NextResponse.json({ 
            error: "Video fetch timed out. Try a smaller video or check the URL." 
          }, { status: 408 });
        }
        console.error("Failed to fetch video URL:", fetchError);
        return NextResponse.json({ 
          error: "Failed to fetch video from URL. Ensure the URL is publicly accessible." 
        }, { status: 400 });
      }
    } else if (videoBase64) {
      parts.push({
        inlineData: {
          data: videoBase64,
          mimeType: mimeType!,
        },
      });
    }

    // Select prompt based on analysis type
    let prompt: string;
    switch (analysisType) {
      case "quick":
        prompt = QUICK_PROMPT;
        break;
      case "scenes":
        prompt = SCENES_PROMPT;
        break;
      case "tags":
        prompt = TAGS_PROMPT;
        break;
      default:
        prompt = DETAILED_PROMPT;
    }

    // Add reference context if provided
    if (reference) {
      prompt = `Context: This video is about "${reference}".\n\n${prompt}`;
    }

    parts.push({ text: prompt });

    console.log(`[Video Analysis] Starting ${analysisType} analysis...`);

    // Generate content
    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    const analysisTime = Date.now() - startTime;
    console.log(`[Video Analysis] Complete in ${analysisTime}ms`);

    // Parse JSON from response
    let parsedResult: any;
    try {
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedResult = JSON.parse(cleanText);
    } catch {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = { rawText: text };
      }
    }

    return NextResponse.json({
      success: true,
      analysis: parsedResult,
      analysisType,
      processingTimeMs: analysisTime,
      model: "gemini-2.0-flash-exp",
    });

  } catch (error) {
    console.error("[Video Analysis] Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("API key")) {
      return NextResponse.json({ 
        error: "Gemini API key not configured" 
      }, { status: 500 });
    }
    
    if (errorMessage.includes("SAFETY")) {
      return NextResponse.json({ 
        error: "Video content was blocked by safety filters" 
      }, { status: 400 });
    }

    if (errorMessage.includes("quota") || errorMessage.includes("429")) {
      return NextResponse.json({ 
        error: "API rate limit exceeded. Please try again in a moment." 
      }, { status: 429 });
    }

    return NextResponse.json({ 
      error: `Video analysis failed: ${errorMessage}` 
    }, { status: 500 });
  }
}

/**
 * GET endpoint for API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/ai/analyze-video",
    method: "POST",
    description: "Fast video analysis using Gemini AI",
    authentication: "Required (user must be logged in)",
    body: {
      videoUrl: "Public URL to video (R2, S3, etc.) - required if no videoBase64",
      videoBase64: "Base64-encoded video data - required if no videoUrl",
      mimeType: "MIME type (required with videoBase64, e.g., 'video/mp4')",
      reference: "Optional context (product name, location, etc.)",
      analysisType: "quick | detailed | scenes | tags (default: detailed)",
    },
    analysisTypes: {
      quick: "Fast basic analysis: name, description, tags, mood (~2-5s)",
      detailed: "Full analysis with scenes, keywords, use cases (~5-15s)",
      scenes: "Scene-by-scene breakdown with timestamps",
      tags: "Comprehensive tag generation by category",
    },
    response: {
      success: "boolean",
      analysis: "Structured analysis result (varies by type)",
      analysisType: "The analysis type used",
      processingTimeMs: "Time taken in milliseconds",
      model: "Gemini model used",
    },
    limits: {
      maxVideoSize: "20MB",
      timeout: "45 seconds for video fetch",
    },
    example: {
      request: {
        videoUrl: "https://your-r2-bucket.com/video.mp4",
        reference: "iPhone 15 Pro product showcase",
        analysisType: "detailed",
      },
    },
  });
}
