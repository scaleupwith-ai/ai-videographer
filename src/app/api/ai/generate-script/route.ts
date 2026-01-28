import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SCRIPT_PROMPT = `You are a professional video scriptwriter. Create a compelling voiceover script with natural speech patterns.

RULES:
- Write natural, conversational narration
- Keep sentences short and punchy
- Match the tone to the video type (professional, inspiring, casual, etc.)
- Aim for 2.5 words per second (150 words per minute)

PAUSES AND EMPHASIS (CRITICAL - use these for natural speech):
- Use <break time="0.5s"/> for short pauses between phrases
- Use <break time="1s"/> for dramatic pauses or section breaks
- Use <break time="1.5s"/> before important announcements
- Add pauses after questions to let them sink in
- Add pauses before key points for emphasis

EXAMPLES:
- "Introducing... <break time="0.5s"/> the future of video creation."
- "Are you ready? <break time="1s"/> Let's begin."
- "And the best part? <break time="0.5s"/> It's completely free."

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "title": "Video Title",
  "script": "Your voiceover script with <break> tags...",
  "estimatedDurationSec": 30,
  "wordCount": 75,
  "tone": "professional|inspiring|casual|energetic|calm"
}`;

interface SelectedAsset {
  id: string;
  filename: string;
  metadata: {
    name?: string;
    description?: string;
  } | null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, description, targetDurationSec, selectedAssets } = await request.json() as {
      prompt?: string;
      description?: string;
      targetDurationSec?: number;
      selectedAssets?: SelectedAsset[];
    };

    const videoDescription = description || prompt;
    if (!videoDescription) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const durationHint = targetDurationSec 
      ? `Target duration: ${targetDurationSec} seconds (approximately ${Math.round(targetDurationSec * 2.5)} words)`
      : "Create a 30-60 second script (75-150 words)";

    // Build asset context if user assets are provided
    let assetContext = "";
    if (selectedAssets && selectedAssets.length > 0) {
      assetContext = "\n\nUSER'S PRODUCT ASSETS (mention these in the script):\n";
      assetContext += selectedAssets.map(asset => {
        const meta = asset.metadata || {};
        return `- ${meta.name || asset.filename}: ${meta.description || "Product asset"}`;
      }).join("\n");
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: SCRIPT_PROMPT },
        { role: "user", content: `${durationHint}\n\nVideo description: ${videoDescription}${assetContext}` },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from AI");
    }

    const scriptData = JSON.parse(responseContent);

    return NextResponse.json({
      title: scriptData.title,
      script: scriptData.script,
      estimatedDurationSec: scriptData.estimatedDurationSec,
      wordCount: scriptData.wordCount,
      tone: scriptData.tone,
    });
  } catch (error) {
    console.error("Script generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate script" },
      { status: 500 }
    );
  }
}

