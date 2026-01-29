import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Sanitize script for TTS - convert symbols to spoken words
// Prevents "$50" from being read as "dollar fifty" or weird pronunciations
function sanitizeScriptForTTS(script: string): string {
  let sanitized = script;
  
  // FIRST: Convert SSML break tags to ElevenLabs-compatible pauses
  // <break time="0.5s"/> -> ... (short pause)
  // <break time="1s"/> -> .... (medium pause)
  // <break time="1.5s"/> or more -> ..... (long pause)
  sanitized = sanitized.replace(/<break\s+time\s*=\s*["']?([\d.]+)s?["']?\s*\/?>/gi, (match, time) => {
    const seconds = parseFloat(time);
    if (seconds >= 1.5) return ' ..... '; // Long pause
    if (seconds >= 1) return ' .... ';    // Medium pause
    if (seconds >= 0.5) return ' ... ';   // Short pause
    return ' .. ';                         // Micro pause
  });
  
  // Remove any other SSML-like tags that might have slipped through
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Convert currency symbols to words BEFORE numbers
  // "$50" -> "50 dollars", "$1.5 million" -> "1.5 million dollars"
  sanitized = sanitized.replace(/\$(\d+(?:\.\d+)?)\s*(million|billion|thousand|hundred)?/gi, (match, num, suffix) => {
    if (suffix) {
      return `${num} ${suffix} dollars`;
    }
    return `${num} dollars`;
  });
  
  // Handle remaining $ signs (like "$" by itself)
  sanitized = sanitized.replace(/\$/g, 'dollars');
  
  // Convert % to "percent"
  sanitized = sanitized.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent');
  
  // Convert & to "and"
  sanitized = sanitized.replace(/\s*&\s*/g, ' and ');
  
  // Convert @ to "at"
  sanitized = sanitized.replace(/@/g, 'at');
  
  // Convert # to "number" when followed by digits, otherwise "hashtag"
  sanitized = sanitized.replace(/#(\d+)/g, 'number $1');
  sanitized = sanitized.replace(/#(\w+)/g, 'hashtag $1');
  
  // Convert + to "plus" when between numbers
  sanitized = sanitized.replace(/(\d)\s*\+\s*(\d)/g, '$1 plus $2');
  
  // Convert = to "equals"
  sanitized = sanitized.replace(/\s*=\s*/g, ' equals ');
  
  // Remove or convert special characters that might cause issues
  // Note: We already removed SSML tags above, so no need to handle < and >
  sanitized = sanitized.replace(/[*_~`<>]/g, '');
  
  // Clean up multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  return sanitized.trim();
}

// Silently enhance script with natural pauses for better voiceover delivery
// Uses "..." which ElevenLabs interprets as natural pauses
function enhanceScriptWithPauses(script: string): string {
  let enhanced = script;
  
  // Add pauses after periods (if not already followed by multiple dots)
  enhanced = enhanced.replace(/\.(?!\.)/g, "...");
  
  // Add pauses after question marks
  enhanced = enhanced.replace(/\?(?!\.)/g, "?...");
  
  // Add pauses after exclamation marks  
  enhanced = enhanced.replace(/!(?!\.)/g, "!...");
  
  // Add slight pauses after commas
  enhanced = enhanced.replace(/,(?!\.)/g, ",..");
  
  // Add pauses after colons
  enhanced = enhanced.replace(/:(?!\.)/g, ":...");
  
  // Add pauses after semicolons
  enhanced = enhanced.replace(/;(?!\.)/g, ";...");
  
  // Clean up any excessive dots (more than 4)
  enhanced = enhanced.replace(/\.{5,}/g, "....");
  
  return enhanced;
}

// Generate timed captions using Deepgram
async function generateTimedCaptions(audioBuffer: Buffer): Promise<{
  captions: Array<{ start: number; end: number; text: string }>;
  formattedCaptions: string;
  durationSec: number;
}> {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!deepgramApiKey) {
    console.log("No Deepgram API key, skipping caption generation");
    return { captions: [], formattedCaptions: "", durationSec: 0 };
  }

  try {
    const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&utterances=true&diarize=false", {
      method: "POST",
      headers: {
        "Authorization": `Token ${deepgramApiKey}`,
        "Content-Type": "audio/mpeg",
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Deepgram error:", error);
      throw new Error("Failed to transcribe audio");
    }

    const result = await response.json();
    
    // Extract word-level timestamps
    const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const durationSec = result.metadata?.duration || 0;
    
    if (words.length === 0) {
      return { captions: [], formattedCaptions: "", durationSec };
    }

    // Group words into caption segments (roughly 2-5 words each or by punctuation)
    const captions: Array<{ start: number; end: number; text: string }> = [];
    let currentSegment: typeof words = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentSegment.push(word);
      
      const isPunctuation = /[.!?,]$/.test(word.punctuated_word || word.word);
      const isLastWord = i === words.length - 1;
      const segmentTooLong = currentSegment.length >= 5;
      
      if (isPunctuation || isLastWord || segmentTooLong) {
        const text = currentSegment.map((w: any) => w.punctuated_word || w.word).join(' ');
        captions.push({
          start: currentSegment[0].start,
          end: currentSegment[currentSegment.length - 1].end,
          text,
        });
        currentSegment = [];
      }
    }

    // Format captions as "0:00-0:05 Hello, how are you?"
    const formattedCaptions = captions
      .map(c => `${formatTime(c.start)}-${formatTime(c.end)} ${c.text}`)
      .join('\n');

    return { captions, formattedCaptions, durationSec };
  } catch (error) {
    console.error("Caption generation error:", error);
    return { captions: [], formattedCaptions: "", durationSec: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { script, voiceId } = await request.json() as {
      script: string;
      voiceId: string; // This is our database voice ID, not ElevenLabs ID
    };

    if (!script || !voiceId) {
      return NextResponse.json({ error: "Script and voiceId are required" }, { status: 400 });
    }

    // Fetch the ElevenLabs voice ID from our database
    const { data: voice, error: voiceError } = await adminSupabase
      .from("voices")
      .select("eleven_labs_id")
      .eq("id", voiceId)
      .single();

    if (voiceError || !voice) {
      console.error("Voice fetch error:", voiceError);
      return NextResponse.json({ error: "Voice not found" }, { status: 404 });
    }

    const elevenLabsVoiceId = voice.eleven_labs_id;

    // First sanitize the script to convert symbols to spoken words
    // This prevents "$50" from being read incorrectly
    const sanitizedScript = sanitizeScriptForTTS(script);
    console.log("Sanitized script for TTS (symbols converted to words)");
    
    // Then enhance with natural pauses for better voiceover delivery
    const enhancedScript = enhanceScriptWithPauses(sanitizedScript);
    console.log("Enhanced script for voiceover (pauses added)");

    // Generate voiceover with ElevenLabs
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: enhancedScript,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const error = await elevenLabsResponse.text();
      console.error("ElevenLabs error:", elevenLabsResponse.status, error);
      
      // Provide more specific error messages
      if (elevenLabsResponse.status === 401) {
        throw new Error("ElevenLabs API key is invalid. Please check your ELEVENLABS_API_KEY.");
      } else if (error.includes("voice_not_fine_tuned") || error.includes("voice_not_found")) {
        throw new Error("This voice is not available. Please select a different voice.");
      } else if (elevenLabsResponse.status === 422) {
        throw new Error("Invalid voice ID or script. Please try a different voice.");
      } else if (elevenLabsResponse.status === 429) {
        throw new Error("ElevenLabs rate limit exceeded. Please try again later.");
      } else {
        throw new Error(`Failed to generate voiceover: ${error.slice(0, 100)}`);
      }
    }

    const audioBuffer = Buffer.from(await elevenLabsResponse.arrayBuffer());

    // Generate timed captions using Deepgram
    const { captions, formattedCaptions, durationSec: deepgramDuration } = await generateTimedCaptions(audioBuffer);

    // Upload to R2
    const key = `voiceovers/${user.id}/${uuid()}.mp3`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: audioBuffer,
        ContentType: "audio/mpeg",
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;

    // Use Deepgram duration if available, otherwise estimate
    const durationSec = deepgramDuration > 0 
      ? Math.round(deepgramDuration) 
      : Math.round(audioBuffer.length / 16000);

    // Create media asset
    const { data: voiceoverAsset, error: assetError } = await adminSupabase
      .from("media_assets")
      .insert({
        owner_id: user.id,
        filename: `voiceover-${Date.now()}.mp3`,
        mime_type: "audio/mpeg",
        size_bytes: audioBuffer.length,
        object_key: key,
        public_url: publicUrl,
        kind: "audio",
        duration_sec: durationSec,
      })
      .select()
      .single();

    if (assetError) {
      console.error("Asset creation error:", assetError);
      throw new Error("Failed to save voiceover");
    }

    return NextResponse.json({
      assetId: voiceoverAsset.id,
      url: publicUrl,
      durationSec,
      sizeBytes: audioBuffer.length,
      captions,
      formattedCaptions,
    });
  } catch (error) {
    console.error("Voiceover generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate voiceover" },
      { status: 500 }
    );
  }
}
