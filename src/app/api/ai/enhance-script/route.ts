import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ENHANCE_PROMPT = `You are a voice acting coach. Take the user's script and enhance it with natural pauses and speech patterns for text-to-speech.

ADD PAUSES USING THESE TAGS:
- <break time="0.3s"/> - micro pause between phrases
- <break time="0.5s"/> - short pause for emphasis
- <break time="1s"/> - dramatic pause or section break
- <break time="1.5s"/> - major transition or before important announcement

GUIDELINES:
- Add pauses after questions
- Add pauses before key points
- Add pauses between sentences for natural flow
- Add longer pauses for section transitions
- Don't overdo it - keep the script natural
- Preserve the original meaning and tone

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "enhancedScript": "The enhanced script with <break> tags...",
  "pauseCount": 5,
  "estimatedDurationIncrease": 2.5
}`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { script } = await request.json() as { script: string };

    if (!script || script.trim().length < 10) {
      return NextResponse.json({ error: "Script is required" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: ENHANCE_PROMPT },
        { role: "user", content: `Enhance this script with natural pauses:\n\n${script}` },
      ],
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(responseContent);

    return NextResponse.json({
      enhancedScript: result.enhancedScript,
      pauseCount: result.pauseCount,
      estimatedDurationIncrease: result.estimatedDurationIncrease,
    });
  } catch (error) {
    console.error("Script enhancement error:", error);
    return NextResponse.json(
      { error: "Failed to enhance script" },
      { status: 500 }
    );
  }
}







