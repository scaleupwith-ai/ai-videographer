import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadBuffer, generateObjectKey, deleteObject } from "@/lib/r2/client";
import { randomUUID } from "crypto";

/**
 * Transcribe Video API
 * 
 * Accepts either:
 * 1. FormData with a file (for small files <50MB)
 * 2. JSON with objectKey (for large files pre-uploaded to R2)
 * 
 * Sends URL to Deepgram for transcription.
 */

export const maxDuration = 300; // 5 minute timeout for long videos
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let uploadedObjectKey: string | null = null;
  
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      console.error("[Transcribe] DEEPGRAM_API_KEY not set");
      return NextResponse.json({ error: "Transcription service not configured" }, { status: 500 });
    }

    // Check content type to determine if this is a FormData upload or JSON with pre-uploaded URL
    const requestContentType = request.headers.get("content-type") || "";
    
    let publicUrl: string | null = null;
    let filename = "video.mp4";
    
    if (requestContentType.includes("application/json")) {
      // Large file flow: file was pre-uploaded to R2, we just get the key
      const body = await request.json();
      const { objectKey, filename: providedFilename } = body;
      
      if (!objectKey) {
        return NextResponse.json({ error: "No objectKey provided" }, { status: 400 });
      }
      
      // Get public URL from object key
      publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${objectKey}`;
      uploadedObjectKey = objectKey; // Mark for cleanup
      filename = providedFilename || "video.mp4";
      
      console.log(`[Transcribe] Using pre-uploaded file: ${publicUrl}`);
      
    } else {
      // Small file flow: FormData upload
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      
      if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
        return NextResponse.json({ error: "File must be a video or audio file" }, { status: 400 });
      }
      
      const fileSizeMB = file.size / 1024 / 1024;
      filename = file.name;
      console.log(`[Transcribe] Processing: ${file.name} (${fileSizeMB.toFixed(2)}MB, type: ${file.type})`);
      
      if (fileSizeMB > 100) {
        return NextResponse.json({ 
          error: "File too large for direct upload. Please try again (system will use cloud upload)." 
        }, { status: 400 });
      }
      
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const videoBuffer = Buffer.from(arrayBuffer);
      
      // Determine content type
      let fileContentType = file.type;
      if (file.type === "video/quicktime") {
        fileContentType = "video/mp4";
      }
      
      // Upload to R2 for URL-based transcription
      console.log(`[Transcribe] Uploading to R2 for URL-based transcription...`);
      
      try {
        const ext = file.name.split('.').pop() || 'mp4';
        uploadedObjectKey = generateObjectKey(user.id, "temp", `transcribe-${randomUUID()}.${ext}`);
        publicUrl = await uploadBuffer(uploadedObjectKey, videoBuffer, fileContentType);
        console.log(`[Transcribe] Uploaded to R2: ${publicUrl}`);
      } catch (uploadError) {
        console.error("[Transcribe] R2 upload failed:", uploadError);
        return NextResponse.json({ 
          error: "Failed to upload file for transcription" 
        }, { status: 500 });
      }
    }
    
    if (!publicUrl) {
      return NextResponse.json({ error: "No video URL available" }, { status: 400 });
    }
    
    // Transcribe using URL
    console.log(`[Transcribe] Sending URL to Deepgram: ${publicUrl}`);
    
    const deepgramResponse = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&utterances=true",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${deepgramApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: publicUrl }),
      }
    );
    
    if (deepgramResponse.ok) {
      const deepgramData = await deepgramResponse.json();
      console.log("[Transcribe] URL-based transcription succeeded");
      return buildResponse(deepgramData);
    }
    
    const errorText = await deepgramResponse.text();
    console.error(`[Transcribe] Deepgram failed (${deepgramResponse.status}): ${errorText.slice(0, 500)}`);
    
    return NextResponse.json({ 
      error: "Transcription failed. Please try a different video format (MP4 recommended)." 
    }, { status: 500 });
    
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Transcription failed" 
    }, { status: 500 });
  } finally {
    // Clean up R2 temp upload
    if (uploadedObjectKey) {
      try { await deleteObject(uploadedObjectKey); } catch { /* ignore */ }
    }
  }
}

function buildResponse(deepgramData: any) {
  // Extract word timings from Deepgram
  const words = deepgramData.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  
  console.log(`[Transcribe] Got ${words.length} words from Deepgram`);
  
  if (words.length === 0) {
    console.warn("[Transcribe] No words detected - video may have no speech");
    return NextResponse.json({
      success: true,
      transcript: "",
      captions: [],
      wordCount: 0,
      duration: 0,
    });
  }
  
  // Build transcript FROM the words array to ensure consistency
  // This guarantees transcript and captions have the exact same words
  const transcript = words.map((w: any) => w.punctuated_word || w.word).join(" ");
  
  console.log(`[Transcribe] Built transcript from words: ${transcript.length} chars`);
  
  // Build caption segments (group words into phrases)
  const captions: Array<{ start: number; end: number; text: string }> = [];
  const wordsPerCaption = 3; // Default words per caption block
  
  for (let i = 0; i < words.length; i += wordsPerCaption) {
    const wordGroup = words.slice(i, i + wordsPerCaption);
    if (wordGroup.length > 0) {
      captions.push({
        start: wordGroup[0].start,
        end: wordGroup[wordGroup.length - 1].end,
        text: wordGroup.map((w: any) => w.punctuated_word || w.word).join(" "),
      });
    }
  }
  
  console.log(`[Transcribe] Created ${captions.length} caption segments covering all ${words.length} words`);
  
  return NextResponse.json({
    success: true,
    transcript,
    captions,
    wordCount: words.length,
    duration: words.length > 0 ? words[words.length - 1].end : 0,
  });
}
