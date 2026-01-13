import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { parseGDriveLink, getDownloadUrl } from "@/lib/gdrive";
import { TimelineV1Schema } from "@/lib/timeline/v1";
import { generateVoiceover, estimateSpeechDuration } from "@/lib/elevenlabs";
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

interface TimelineScene {
  clipId: string;
  description: string;
  inSec: number;
  outSec: number;
}

interface AITimeline {
  title: string;
  voiceover?: string;
  scenes: TimelineScene[];
}

interface RequestBody {
  timeline: AITimeline;
  projectTitle?: string;
  voiceId?: string; // ElevenLabs voice ID if voiceover is wanted
  includeVoiceover?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { timeline, projectTitle, voiceId, includeVoiceover } = await request.json() as RequestBody;

    if (!timeline || !timeline.scenes || timeline.scenes.length === 0) {
      return NextResponse.json({ error: "Invalid timeline" }, { status: 400 });
    }

    // Fetch all the clips used in the timeline
    const clipIds = timeline.scenes.map(s => s.clipId);
    const { data: clips, error: clipsError } = await adminSupabase
      .from("clips")
      .select("*")
      .in("id", clipIds);

    if (clipsError || !clips) {
      console.error("Failed to fetch clips:", clipsError);
      return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
    }

    // Create a map of clip ID to clip data
    const clipMap = new Map(clips.map(c => [c.id, c]));

    // First, create media_assets entries for each clip (so FFmpeg worker can download them)
    // Use adminSupabase to bypass RLS
    const assetPromises = clips.map(async (clip) => {
      const { fileId, directUrl } = parseGDriveLink(clip.clip_link);
      if (!fileId || !directUrl) {
        throw new Error(`Invalid clip link for clip ${clip.id}`);
      }

      // Check if asset already exists for this clip
      const { data: existingAsset } = await adminSupabase
        .from("media_assets")
        .select("id")
        .eq("object_key", `gdrive:${fileId}`)
        .eq("owner_id", user.id)
        .single();

      if (existingAsset) {
        return { clipId: clip.id, assetId: existingAsset.id };
      }

      // Create new media asset entry using admin client
      // Column names: object_key, public_url, kind (enum: video, image, audio, srt, logo)
      const { data: newAsset, error: assetError } = await adminSupabase
        .from("media_assets")
        .insert({
          owner_id: user.id,
          filename: `clip-${clip.id}.mp4`,
          mime_type: "video/mp4",
          size_bytes: 0, // Unknown for GDrive
          object_key: `gdrive:${fileId}`,
          public_url: getDownloadUrl(fileId),
          kind: "video",
          duration_sec: clip.duration_seconds,
        })
        .select()
        .single();

      if (assetError || !newAsset) {
        console.error("Asset creation error:", assetError);
        throw new Error(`Failed to create asset for clip ${clip.id}`);
      }

      return { clipId: clip.id, assetId: newAsset.id };
    });

    const assetMappings = await Promise.all(assetPromises);
    const clipToAsset = new Map(assetMappings.map(m => [m.clipId, m.assetId]));

    // Build the timeline JSON
    const scenes = timeline.scenes.map((scene, index) => {
      const clip = clipMap.get(scene.clipId);
      const assetId = clipToAsset.get(scene.clipId);
      
      return {
        id: `scene-${index + 1}`,
        order: index,
        assetId: assetId || null,
        kind: "video" as const,
        inSec: scene.inSec,
        outSec: scene.outSec,
        durationSec: scene.outSec - scene.inSec,
        overlays: {
          title: null,
          subtitle: null,
          position: "lower_third",
          stylePreset: "minimal",
        },
      };
    });

    const totalDuration = scenes.reduce((sum, s) => sum + s.durationSec, 0);

    // Generate voiceover if requested and script is provided
    let voiceoverAssetId: string | null = null;
    
    if (includeVoiceover && timeline.voiceover && timeline.voiceover.trim() && voiceId) {
      try {
        console.log("Generating voiceover with voice:", voiceId);
        
        // Validate voiceover duration won't exceed video duration
        const estimatedDuration = estimateSpeechDuration(timeline.voiceover);
        if (estimatedDuration > totalDuration) {
          console.warn(`Voiceover estimated ${estimatedDuration}s may exceed video duration ${totalDuration}s`);
        }

        const audioBuffer = await generateVoiceover({
          text: timeline.voiceover,
          voiceId,
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

        // Create media asset using admin client
        // Column names: object_key, public_url, kind (enum: video, image, audio, srt, logo)
        const { data: voiceoverAsset, error: voiceoverError } = await adminSupabase
          .from("media_assets")
          .insert({
            owner_id: user.id,
            filename: `voiceover-${Date.now()}.mp3`,
            mime_type: "audio/mpeg",
            size_bytes: audioBuffer.length,
            object_key: key,
            public_url: publicUrl,
            kind: "audio",
          })
          .select()
          .single();

        if (voiceoverError) {
          console.error("Failed to create voiceover asset:", voiceoverError);
        } else if (voiceoverAsset) {
          voiceoverAssetId = voiceoverAsset.id;
          console.log("Voiceover generated:", voiceoverAssetId);
        }
      } catch (voiceError) {
        console.error("Failed to generate voiceover:", voiceError);
        // Continue without voiceover - don't fail the whole request
      }
    }

    const timelineJson = {
      version: 1,
      project: {
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        durationSec: totalDuration,
      },
      scenes,
      global: {
        music: { assetId: null, volume: 0.3 },
        voiceover: { assetId: voiceoverAssetId, volume: 1.0 },
        brand: {
          logoAssetId: null,
          logoPosition: "top-right",
          logoSize: 80,
        },
        export: {
          codec: "h264",
          crf: 23,
          bitrateMbps: 8,
          audioKbps: 192,
        },
      },
    };

    // Validate the timeline
    const parseResult = TimelineV1Schema.safeParse(timelineJson);
    if (!parseResult.success) {
      console.error("Timeline validation error:", parseResult.error);
      return NextResponse.json({ error: "Failed to generate valid timeline" }, { status: 500 });
    }

    // Create the project using admin client
    const { data: project, error: projectError } = await adminSupabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: projectTitle || timeline.title || "AI Generated Video",
        description: `AI-curated video with ${scenes.length} clips`,
        timeline_json: timelineJson,
        status: "draft",
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error("Project creation error:", projectError);
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json({
      projectId: project.id,
      timeline: timelineJson,
    });
  } catch (error) {
    console.error("Generate timeline error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate timeline" },
      { status: 500 }
    );
  }
}

