import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs/promises";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

async function generateThumbnail(videoUrl: string): Promise<Buffer | null> {
  const tempDir = os.tmpdir();
  const outputPath = path.join(tempDir, `thumb-${Date.now()}.jpg`);
  
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", videoUrl,
      "-ss", "00:00:01",
      "-vframes", "1",
      "-vf", "scale=320:-1",
      "-q:v", "2",
      "-y",
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", async (code) => {
      if (code === 0) {
        try {
          const buffer = await fs.readFile(outputPath);
          await fs.unlink(outputPath).catch(() => {});
          resolve(buffer);
        } catch {
          resolve(null);
        }
      } else {
        console.error("FFmpeg error:", stderr);
        resolve(null);
      }
    });

    ffmpeg.on("error", () => {
      resolve(null);
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      ffmpeg.kill();
      resolve(null);
    }, 60000);
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    
    // Get all clips without thumbnails
    const { data: clips, error } = await supabase
      .from("clips")
      .select("id, clip_link")
      .is("thumbnail_url", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!clips || clips.length === 0) {
      return NextResponse.json({ message: "All clips already have thumbnails", processed: 0 });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const clip of clips) {
      try {
        const thumbnailBuffer = await generateThumbnail(clip.clip_link);
        
        if (!thumbnailBuffer) {
          results.push({ id: clip.id, success: false, error: "Failed to generate thumbnail" });
          continue;
        }

        // Upload to R2
        const objectKey = `thumbnails/clips/${clip.id}-thumb.jpg`;
        
        await s3.send(new PutObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: objectKey,
          Body: thumbnailBuffer,
          ContentType: "image/jpeg",
        }));

        const thumbnailUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${objectKey}`;

        // Update clip record
        await supabase
          .from("clips")
          .update({ thumbnail_url: thumbnailUrl })
          .eq("id", clip.id);

        results.push({ id: clip.id, success: true });
      } catch (err) {
        results.push({ id: clip.id, success: false, error: String(err) });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Generated ${successful} thumbnails, ${failed} failed`,
      processed: clips.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error generating thumbnails:", error);
    return NextResponse.json({ error: "Failed to generate thumbnails" }, { status: 500 });
  }
}







