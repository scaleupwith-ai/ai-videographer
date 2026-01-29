/**
 * AI Video Agent Runner
 * 
 * This module runs the AI agent with tool calling capabilities.
 * The agent can call tools multiple times, retry on failures, and build
 * a complete video timeline autonomously.
 */

import OpenAI from "openai";
import { AGENT_TOOLS, executeTool } from "./tools";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Maximum number of tool call iterations
const MAX_ITERATIONS = 10;

export interface AgentContext {
  script: string;
  duration: number;
  description: string;
  brandColors: { primary: string; secondary: string; accent: string };
  timedCaptions?: string;
}

export interface AgentResult {
  success: boolean;
  clips: Array<{
    id: string;
    title: string;
    startTime: number;
    duration: number;
  }>;
  music?: {
    id: string;
    title: string;
    volume: number;
  };
  soundEffects: Array<{
    id: string;
    title: string;
    atTime: number;
    volume: number;
  }>;
  effects: Array<{
    id: string;
    name: string;
    startTime: number;
    duration: number;
    config: Record<string, unknown>;
  }>;
  reasoning?: string;
  error?: string;
}

const AGENT_SYSTEM_PROMPT = `You are an AI Video Director. Your job is to create engaging video timelines by selecting clips, music, sound effects, and visual effects.

IMPORTANT RULES:
1. Start by searching for clips that match the script/description
2. Select music that matches the mood of the content
3. Add 1-3 sound effects at impactful moments (not too many!)
4. Add visual effects (lower thirds, callouts, etc.) at appropriate moments
5. Effects with text MUST have enough time for users to read (2 seconds per word minimum)
6. Don't overload the video with effects - less is more
7. Consider the script timing when placing elements

EFFECT USAGE GUIDELINES:
- lower-third-minimal: Use when introducing a person, speaker, or topic
- slide-box-left/right: Use for key points, chapter markers, or agenda items
- letterbox-with-text: Use for cinematic moments, location text, or timestamps
- corner-accents: Use to frame important segments
- border-glow: Use for emphasis or tech/futuristic feel

When you have gathered enough information, provide a summary of what you've selected.`;

/**
 * Run the AI agent to build a video timeline
 */
export async function runVideoAgent(context: AgentContext): Promise<AgentResult> {
  const result: AgentResult = {
    success: false,
    clips: [],
    soundEffects: [],
    effects: [],
  };
  
  const userPrompt = `Create a video timeline for the following:

Duration: ${context.duration} seconds
Description: ${context.description}

Script:
"${context.script}"

${context.timedCaptions ? `\nTimed Captions:\n${context.timedCaptions}` : ""}

Please:
1. Search for relevant video clips that match the content
2. Find appropriate background music
3. Add 1-3 sound effects at impactful moments
4. Add visual effects where they enhance the content (but don't overdo it)
5. Ensure any text effects have at least 2 seconds per word for readability

Start by searching for clips, then build out the timeline.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  try {
    let iterations = 0;
    
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      console.log(`[Agent] Iteration ${iterations}/${MAX_ITERATIONS}`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: AGENT_TOOLS,
        tool_choice: iterations < 3 ? "auto" : "auto", // Force tool use early, then let it decide
      });
      
      const message = response.choices[0].message;
      messages.push(message);
      
      // Check if the agent wants to call tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[Agent] Calling ${message.tool_calls.length} tools`);
        
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolParams = JSON.parse(toolCall.function.arguments);
          
          const toolResult = await executeTool(toolName, toolParams, context.brandColors);
          
          // Parse the result and accumulate data
          try {
            const parsed = JSON.parse(toolResult);
            
            if (parsed.success) {
              // Handle add_effect results
              if (toolName === "add_effect" && parsed.effect) {
                result.effects.push(parsed.effect);
              }
              // Handle search results - agent will use these in subsequent calls
            }
          } catch {
            // Tool result wasn't JSON, that's fine
          }
          
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } else {
        // No more tool calls - agent is done
        console.log(`[Agent] Agent finished reasoning`);
        result.reasoning = message.content || undefined;
        result.success = true;
        break;
      }
    }
    
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[Agent] Hit max iterations (${MAX_ITERATIONS})`);
      result.success = true; // Still consider it a success with partial results
    }
    
    return result;
    
  } catch (error) {
    console.error("[Agent] Error:", error);
    result.error = error instanceof Error ? error.message : "Agent failed";
    return result;
  }
}

/**
 * Quick agent call for specific tasks (single tool call)
 */
export async function quickAgentTask(
  task: "select_clips" | "select_music" | "select_effects",
  context: {
    description: string;
    duration: number;
    script?: string;
    brandColors?: { primary: string; secondary: string; accent: string };
  }
): Promise<unknown> {
  const brandColors = context.brandColors || {
    primary: "#00f0ff",
    secondary: "#36454f", 
    accent: "#ff7f50"
  };
  
  switch (task) {
    case "select_clips": {
      const result = await executeTool("search_clips", {
        query: context.description,
        limit: 10,
      }, brandColors);
      return JSON.parse(result);
    }
    case "select_music": {
      const result = await executeTool("search_music", {
        limit: 5,
      }, brandColors);
      return JSON.parse(result);
    }
    case "select_effects": {
      const result = await executeTool("get_available_effects", {}, brandColors);
      return JSON.parse(result);
    }
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

