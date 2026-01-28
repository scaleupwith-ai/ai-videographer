import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Use the same env vars as other routes - check both naming conventions
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  },
});

const bucketName = process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL;

// POST - Get presigned URL for uploading media OR fetch from URL and upload
export async function POST(request: NextRequest) {
  try {
    // Check if R2 is configured
    if (!bucketName || !publicBaseUrl) {
      console.error("R2 not configured - missing bucket or public URL");
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { filename, contentType, type, fetchUrl } = body;

    // type: 'music' | 'sfx' | 'overlay' | 'clip'
    const folder = type === 'music' ? 'music' 
                 : type === 'sfx' ? 'sound-effects'
                 : type === 'overlay' ? 'overlays'
                 : 'clips';

    if (fetchUrl) {
      // Fetch from URL and upload to R2
      try {
        console.log(`Fetching from URL: ${fetchUrl}`);
        const response = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
          return NextResponse.json({ error: `Failed to fetch from URL: ${response.status}` }, { status: 400 });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length === 0) {
          return NextResponse.json({ error: "Fetched file is empty" }, { status: 400 });
        }
        
        // Determine content type from URL or response
        const detectedContentType = response.headers.get('content-type') || contentType || 'application/octet-stream';
        
        // Generate filename from URL if not provided
        const finalFilename = filename || fetchUrl.split('/').pop()?.split('?')[0] || `file-${Date.now()}`;
        const ext = finalFilename.includes('.') ? '' : getExtFromContentType(detectedContentType);
        
        const objectKey = `${folder}/${Date.now()}-${sanitizeFilename(finalFilename)}${ext}`;
        
        console.log(`Uploading to R2: ${objectKey} (${buffer.length} bytes)`);
        await s3.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: buffer,
          ContentType: detectedContentType,
        }));

        const resultUrl = `${publicBaseUrl}/${objectKey}`;
        console.log(`Upload successful: ${resultUrl}`);
        
        return NextResponse.json({ 
          publicUrl: resultUrl,
          objectKey,
          contentType: detectedContentType,
          size: buffer.length,
        });
      } catch (fetchError) {
        console.error("Error fetching URL:", fetchError);
        return NextResponse.json({ error: "Failed to fetch and upload from URL" }, { status: 500 });
      }
    }

    // Return presigned URL for direct upload
    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required for direct upload" },
        { status: 400 }
      );
    }

    const objectKey = `${folder}/${Date.now()}-${sanitizeFilename(filename)}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const resultUrl = `${publicBaseUrl}/${objectKey}`;

    console.log(`Generated presigned URL for: ${objectKey}`);
    return NextResponse.json({ uploadUrl, publicUrl: resultUrl, objectKey });
  } catch (error) {
    console.error("Error in upload-media:", error);
    return NextResponse.json({ error: "Failed to process upload request" }, { status: 500 });
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function getExtFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/aac': '.aac',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return map[contentType] || '';
}

