import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { parseGDriveLink } from "@/lib/gdrive";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Clip {
  id: string;
  clip_link: string;
  duration_seconds: number;
  description: string | null;
  tags: string[];
}

const SYSTEM_PROMPT = `You are an AI video editor. When a user describes a video they want, you IMMEDIATELY create a timeline using the available clips. Do NOT ask questions or have a conversation - just create the video.

YOUR TASK:
1. Look at the available clips
2. Select the best clips that match the user's request
3. Create a timeline with those clips
4. Write a voiceover script
5. Output the timeline JSON - ALWAYS include the timeline block

VOICEOVER RULES (CRITICAL):
- Average speaking rate is 150 words per minute (2.5 words per second)
- For a 30-second video: MAX 60-70 words
- For a 60-second video: MAX 120-140 words
- Keep sentences SHORT and punchy
- Match the tone to the visuals

OUTPUT FORMAT - You MUST include this JSON block in EVERY response:

\`\`\`timeline
{
  "title": "Video Title",
  "voiceover": "Your voiceover script here. Keep it under the word limit based on video duration.",
  "scenes": [
    {
      "clipId": "actual-clip-uuid-from-library",
      "description": "Brief description",
      "inSec": 0,
      "outSec": 5
    }
  ]
}
\`\`\`

IMPORTANT:
- ALWAYS output the timeline JSON block - never respond without it
- Only use clipIds from the available clips list
- If no clips are available, say "No clips available in the library yet" and do NOT output a timeline
- Be brief in your explanation - the user wants the video, not a conversation
- After the JSON block, add a SHORT summary (1-2 sentences) of what you created`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, searchClips } = await request.json() as { 
      messages: Message[]; 
      searchClips?: boolean;
    };

    // If searchClips flag is set, search the clips table first
    let clipContext = "";
    if (searchClips) {
      // Get the last user message to extract search terms
      const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMessage) {
        // Search clips based on user's description
        const { data: clips, error } = await supabase
          .from("clips")
          .select("*")
          .limit(50);

        if (!error && clips && clips.length > 0) {
          clipContext = `\n\nAvailable clips in the library:\n${clips.map((clip: Clip) => {
            const { fileId } = parseGDriveLink(clip.clip_link);
            return `- ID: ${clip.id}
  Description: ${clip.description || "No description"}
  Tags: ${clip.tags?.join(", ") || "None"}
  Duration: ${clip.duration_seconds}s
  Preview: ${fileId ? `https://drive.google.com/file/d/${fileId}/preview` : "N/A"}`;
          }).join("\n\n")}`;
        } else {
          clipContext = "\n\nNote: No clips are currently available in the library. The admin needs to add clips to the Clips table first.";
        }
      }
    }

    // Prepare messages for OpenAI
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT + clipContext },
      ...messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content || "I apologize, I couldn't generate a response.";

    // Check if the response contains a timeline JSON
    let timeline = null;
    const timelineMatch = responseContent.match(/```timeline\n([\s\S]*?)\n```/);
    if (timelineMatch) {
      try {
        timeline = JSON.parse(timelineMatch[1]);
      } catch {
        // Invalid JSON, ignore
      }
    }

    return NextResponse.json({
      message: responseContent,
      timeline,
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 }
    );
  }
}

