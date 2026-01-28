import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";
import https from "https";
import http from "http";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

interface MigrationResult {
  clipId: string;
  description: string | null;
  status: "success" | "skipped" | "error";
  error?: string;
  oldLink?: string;
  newLink?: string;
}

// Extract Google Drive file ID from various link formats
function extractGDriveFileId(url: string): string | null {
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return fileMatch[1];

  // Format: https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) return openMatch[1];

  // Format: https://docs.google.com/document/d/FILE_ID/
  const docsMatch = url.match(/\/d\/([^/]+)/);
  if (docsMatch) return docsMatch[1];

  return null;
}

// Download file from Google Drive with confirmation bypass
async function downloadFromGDrive(fileId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    
    const request = https.get(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          // Follow redirect
          const protocol = redirectUrl.startsWith("https") ? https : http;
          protocol.get(redirectUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          }, (redirectResponse) => {
            const chunks: Buffer[] = [];
            redirectResponse.on("data", (chunk) => chunks.push(chunk));
            redirectResponse.on("end", () => resolve(Buffer.concat(chunks)));
            redirectResponse.on("error", reject);
          }).on("error", reject);
          return;
        }
      }

      // Check if we got an HTML page (confirmation page)
      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("text/html")) {
        // Try with confirm=t parameter and read the page
        let html = "";
        response.on("data", (chunk) => { html += chunk.toString(); });
        response.on("end", () => {
          // Look for confirm token in HTML
          const confirmMatch = html.match(/confirm=([^&"]+)/);
          if (confirmMatch) {
            const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
            https.get(confirmUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
            }, (confirmResponse) => {
              if (confirmResponse.statusCode === 301 || confirmResponse.statusCode === 302) {
                const finalUrl = confirmResponse.headers.location;
                if (finalUrl) {
                  https.get(finalUrl, (finalResponse) => {
                    const chunks: Buffer[] = [];
                    finalResponse.on("data", (chunk) => chunks.push(chunk));
                    finalResponse.on("end", () => resolve(Buffer.concat(chunks)));
                    finalResponse.on("error", reject);
                  }).on("error", reject);
                  return;
                }
              }
              const chunks: Buffer[] = [];
              confirmResponse.on("data", (chunk) => chunks.push(chunk));
              confirmResponse.on("end", () => resolve(Buffer.concat(chunks)));
              confirmResponse.on("error", reject);
            }).on("error", reject);
          } else {
            reject(new Error("Could not bypass Google Drive confirmation page"));
          }
        });
        return;
      }

      // Direct download
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });

    request.on("error", reject);
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error("Download timeout"));
    });
  });
}

// POST - Migrate all Google Drive clips to R2
export async function POST() {
  try {
    const supabase = getAdminSupabase();

    // Get all clips with Google Drive links
    const { data: clips, error } = await supabase
      .from("clips")
      .select("*")
      .or("clip_link.ilike.%drive.google.com%,clip_link.ilike.%docs.google.com%");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!clips || clips.length === 0) {
      return NextResponse.json({ 
        message: "No Google Drive clips to migrate",
        results: [] 
      });
    }

    const results: MigrationResult[] = [];

    for (const clip of clips) {
      try {
        const fileId = extractGDriveFileId(clip.clip_link);
        if (!fileId) {
          results.push({
            clipId: clip.id,
            description: clip.description,
            status: "skipped",
            error: "Could not extract file ID from URL",
            oldLink: clip.clip_link,
          });
          continue;
        }

        // Download from Google Drive
        console.log(`Downloading clip ${clip.id} from Google Drive...`);
        let buffer: Buffer;
        try {
          buffer = await downloadFromGDrive(fileId);
        } catch (downloadError) {
          results.push({
            clipId: clip.id,
            description: clip.description,
            status: "skipped",
            error: `Download failed: ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`,
            oldLink: clip.clip_link,
          });
          continue;
        }

        // Check if we got actual video data (not HTML)
        const first100 = buffer.slice(0, 100).toString();
        if (first100.includes("<!DOCTYPE") || first100.includes("<html")) {
          results.push({
            clipId: clip.id,
            description: clip.description,
            status: "skipped",
            error: "Downloaded HTML instead of video - file may not be public",
            oldLink: clip.clip_link,
          });
          continue;
        }

        // Upload to R2
        const key = `clips/${uuid()}.mp4`;
        console.log(`Uploading clip ${clip.id} to R2...`);
        
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: "video/mp4",
        }));

        const newUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;

        // Update clip in database
        await supabase
          .from("clips")
          .update({ 
            clip_link: newUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", clip.id);

        results.push({
          clipId: clip.id,
          description: clip.description,
          status: "success",
          oldLink: clip.clip_link,
          newLink: newUrl,
        });

        console.log(`Successfully migrated clip ${clip.id}`);
      } catch (clipError) {
        results.push({
          clipId: clip.id,
          description: clip.description,
          status: "error",
          error: clipError instanceof Error ? clipError.message : "Unknown error",
          oldLink: clip.clip_link,
        });
      }
    }

    const successful = results.filter(r => r.status === "success").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const errors = results.filter(r => r.status === "error").length;

    return NextResponse.json({
      message: `Migration complete: ${successful} migrated, ${skipped} skipped, ${errors} errors`,
      results,
      summary: { successful, skipped, errors, total: clips.length },
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    );
  }
}







