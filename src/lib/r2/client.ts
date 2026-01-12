import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 client configuration
export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!;

/**
 * Generate a presigned URL for uploading a file to R2
 */
export async function createUploadUrl(
  objectKey: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });
  
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading a file from R2
 */
export async function createDownloadUrl(
  objectKey: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
  });
  
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Get the public URL for an object (if bucket has public access enabled)
 */
export function getPublicUrl(objectKey: string): string {
  return `${PUBLIC_BASE_URL}/${objectKey}`;
}

/**
 * Delete an object from R2
 */
export async function deleteObject(objectKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
  });
  
  await r2Client.send(command);
}

/**
 * Generate a unique object key for an upload
 */
export function generateObjectKey(
  userId: string,
  kind: "video" | "image" | "audio" | "srt" | "logo" | "render",
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${userId}/${kind}s/${timestamp}-${sanitizedFilename}`;
}

