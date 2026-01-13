import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { generateVoiceover } from "@/lib/elevenlabs";
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { script, voiceId, maxDuration } = await request.json() as {
      script: string;
      voiceId?: string;
      maxDuration?: number; // Maximum duration in seconds
    };

    if (!script) {
      return NextResponse.json({ error: "Script is required" }, { status: 400 });
    }

    // Get voice to use (either specified or default)
    const adminSupabase = getAdminSupabase();
    let elevenLabsVoiceId = voiceId;

    if (!elevenLabsVoiceId) {
      // Get default voice
      const { data: defaultVoice } = await adminSupabase
        .from("voices")
        .select("eleven_labs_id")
        .eq("is_default", true)
        .single();

      if (defaultVoice) {
        elevenLabsVoiceId = defaultVoice.eleven_labs_id;
      } else {
        // Get first available voice
        const { data: firstVoice } = await adminSupabase
          .from("voices")
          .select("eleven_labs_id")
          .limit(1)
          .single();

        if (firstVoice) {
          elevenLabsVoiceId = firstVoice.eleven_labs_id;
        } else {
          return NextResponse.json(
            { error: "No voices configured. Please add a voice in the admin panel." },
            { status: 400 }
          );
        }
      }
    }

    // Generate the voiceover
    console.log("Generating voiceover with voice:", elevenLabsVoiceId);
    const audioBuffer = await generateVoiceover({
      text: script,
      voiceId: elevenLabsVoiceId,
    });

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

    // Create media asset entry
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .insert({
        owner_id: user.id,
        filename: `voiceover-${Date.now()}.mp3`,
        mime_type: "audio/mpeg",
        size_bytes: audioBuffer.length,
        storage_key: key,
        url: publicUrl,
        asset_type: "audio",
      })
      .select()
      .single();

    if (assetError) {
      console.error("Error creating asset:", assetError);
      return NextResponse.json({ error: "Failed to save voiceover" }, { status: 500 });
    }

    return NextResponse.json({
      assetId: asset.id,
      url: publicUrl,
      durationEstimate: script.split(/\s+/).length / 150 * 60, // Rough estimate
    });
  } catch (error) {
    console.error("Voiceover generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate voiceover" },
      { status: 500 }
    );
  }
}

