import { execa } from "execa";
import { createWriteStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import os from "os";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const RESOLUTION_SIZES = {
  "4k": { width: 3840, height: 2160 },
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
} as const;

// Initialize R2 client
function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log(`[Renditions] Downloading: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  
  const fileStream = createWriteStream(outputPath);
  // @ts-ignore - Response body is a ReadableStream
  await pipeline(response.body, fileStream);
  
  console.log(`[Renditions] Downloaded to: ${outputPath}`);
}

async function uploadToR2(localPath: string, key: string): Promise<string> {
  const r2 = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME || "ai-videographer";
  
  const fileBuffer = await fs.readFile(localPath);
  
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: "video/mp4",
  }));
  
  const publicUrl = `https://pub-8a72a32a722d4070916a416277ad327a.r2.dev/${key}`;
  console.log(`[Renditions] Uploaded to R2: ${publicUrl}`);
  
  return publicUrl;
}

async function transcodeToResolution(
  inputPath: string,
  outputPath: string,
  targetResolution: keyof typeof RESOLUTION_SIZES
): Promise<void> {
  const size = RESOLUTION_SIZES[targetResolution];
  
  // Use libx264 with good compression
  // scale=-2:height keeps aspect ratio, -2 ensures divisible by 2
  const args = [
    "-i", inputPath,
    "-vf", `scale=-2:${size.height}`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y", // Overwrite output
    outputPath,
  ];
  
  console.log(`[Renditions] Transcoding to ${targetResolution}...`);
  console.log(`[Renditions] FFmpeg args:`, args.join(" "));
  
  await execa("ffmpeg", args);
  
  console.log(`[Renditions] Transcoded to: ${outputPath}`);
}

export async function generateRenditions(
  clipId: string,
  sourceUrl: string,
  targetResolutions: string[]
): Promise<{ resolution: string; url: string }[]> {
  const supabase = getSupabaseAdmin();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "renditions-"));
  const results: { resolution: string; url: string }[] = [];
  
  try {
    // Download source file
    const sourceExt = sourceUrl.split(".").pop() || "mp4";
    const sourcePath = path.join(tempDir, `source.${sourceExt}`);
    await downloadFile(sourceUrl, sourcePath);
    
    // Generate each rendition
    for (const resolution of targetResolutions) {
      if (!(resolution in RESOLUTION_SIZES)) {
        console.warn(`[Renditions] Unknown resolution: ${resolution}, skipping`);
        continue;
      }
      
      const outputPath = path.join(tempDir, `${resolution}.mp4`);
      
      try {
        // Transcode
        await transcodeToResolution(
          sourcePath,
          outputPath,
          resolution as keyof typeof RESOLUTION_SIZES
        );
        
        // Upload to R2
        const r2Key = `clips/${clipId}/${resolution}.mp4`;
        const publicUrl = await uploadToR2(outputPath, r2Key);
        
        // Save to database
        const { error } = await supabase
          .from("clip_renditions")
          .upsert({
            clip_id: clipId,
            resolution: resolution,
            video_url: publicUrl,
            object_key: r2Key,
          }, {
            onConflict: "clip_id,resolution",
          });
        
        if (error) {
          console.error(`[Renditions] DB error for ${resolution}:`, error);
        } else {
          console.log(`[Renditions] Saved ${resolution} rendition to DB`);
        }
        
        results.push({ resolution, url: publicUrl });
        
        // Clean up output file
        await fs.unlink(outputPath).catch(() => {});
        
      } catch (error) {
        console.error(`[Renditions] Failed to generate ${resolution}:`, error);
        // Continue with other resolutions
      }
    }
    
    return results;
    
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}







