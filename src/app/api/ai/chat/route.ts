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

const SYSTEM_PROMPT = `You are an AI video editor assistant. Your job is to help users create video timelines using available b-roll clips from the library.

When a user describes what kind of video they want to create, you should:
1. Understand their vision and goals
2. Search for relevant clips from the library based on their description
3. Suggest a timeline/sequence of clips that tells their story
4. Be creative and helpful in curating the best clips for their needs

When suggesting clips, explain WHY you chose each clip and how it fits into the narrative.

You have access to a library of b-roll clips. Each clip has:
- A description of what's in the clip
- Tags for categorization  
- Duration in seconds

When you're ready to create a timeline, format your response with a special JSON block that the system can parse:

\`\`\`timeline
{
  "title": "Video Title",
  "scenes": [
    {
      "clipId": "clip-uuid-here",
      "description": "Why this clip works here",
      "inSec": 0,
      "outSec": 5
    }
  ]
}
\`\`\`

Always be conversational and explain your creative choices. Ask clarifying questions if the user's request is vague.`;

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

