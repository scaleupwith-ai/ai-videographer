import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { spawn } from "child_process";
import { Readable } from "stream";
import path from "path";
import os from "os";
import fs from "fs/promises";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

// Generate thumbnail from video using ffmpeg
async function generateThumbnail(videoUrl: string): Promise<Buffer | null> {
  const tempDir = os.tmpdir();
  const outputPath = path.join(tempDir, `thumb-${Date.now()}.jpg`);
  
  return new Promise((resolve) => {
    // Use ffmpeg to extract first frame
    const ffmpeg = spawn("ffmpeg", [
      "-i", videoUrl,
      "-ss", "00:00:01", // 1 second in
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
        console.error("FFmpeg thumbnail generation failed:", stderr);
        resolve(null);
      }
    });

    ffmpeg.on("error", () => {
      resolve(null);
    });
  });
}

// POST - Generate and upload thumbnail for a video
export async function POST(request: NextRequest) {
  try {
    const { videoUrl, assetId } = await request.json();

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(videoUrl);
    
    if (!thumbnailBuffer) {
      return NextResponse.json({ error: "Failed to generate thumbnail" }, { status: 500 });
    }

    // Upload to R2
    const objectKey = `thumbnails/${assetId || Date.now()}-thumb.jpg`;
    
    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: objectKey,
      Body: thumbnailBuffer,
      ContentType: "image/jpeg",
    }));

    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${objectKey}`;

    return NextResponse.json({ thumbnailUrl: publicUrl });
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    return NextResponse.json({ error: "Failed to generate thumbnail" }, { status: 500 });
  }
}







