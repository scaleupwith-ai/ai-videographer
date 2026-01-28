// Worker configuration
// Supports both local .env naming and AWS SSM Parameter Store naming
export const config = {
  // Supabase (local: NEXT_PUBLIC_SUPABASE_URL, SSM: SUPABASE_URL)
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // R2 / S3 (same naming for both)
  r2Endpoint: process.env.R2_ENDPOINT || "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  r2Bucket: process.env.R2_BUCKET || "ai-videographer",
  r2PublicBaseUrl: process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || "",

  // FFmpeg
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",

  // Temp directory for rendering
  tempDir: process.env.TEMP_DIR || "/tmp/renders",
  
  // AWS Batch mode detection
  isBatchJob: !!process.env.AWS_BATCH_JOB_ID,
};

