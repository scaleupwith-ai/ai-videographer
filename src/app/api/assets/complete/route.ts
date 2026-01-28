import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/r2/client";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      objectKey, 
      filename, 
      mime, 
      kind, 
      sizeBytes, 
      durationSec, 
      width, 
      height, 
      tags, 
      metadata,
      reference,           // Product name/address for AI context
      generateDescription  // If true, will trigger background AI description
    } = body;

    if (!objectKey || !filename || !mime || !kind) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get public URL for the asset
    const publicUrl = getPublicUrl(objectKey);

    // Build insert data - only include columns that exist in the database
    // The status and reference columns are optional (added in migration 20260116)
    const insertData: Record<string, unknown> = {
      owner_id: user.id,
      bucket: process.env.R2_BUCKET || "ai-videographer",
      object_key: objectKey,
      public_url: publicUrl,
      kind,
      filename,
      mime_type: mime,
      size_bytes: sizeBytes || null,
      duration_sec: durationSec || null,
      width: width || null,
      height: height || null,
      tags: tags || [],
      metadata: metadata || {},
    };

    // Try to include new columns if they exist (graceful degradation)
    // These will be ignored if the columns don't exist yet
    if (reference !== undefined) {
      insertData.reference = reference || null;
    }
    if (generateDescription !== undefined) {
      insertData.status = generateDescription ? 'processing' : 'ready';
    }

    // Insert asset into database
    const { data: asset, error: insertError } = await supabase
      .from("media_assets")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting asset:", insertError);
      console.error("Insert data was:", JSON.stringify(insertData, null, 2));
      
      // If error is about unknown columns, retry without the new columns
      if (insertError.message?.includes('column') || insertError.code === '42703') {
        console.log("Retrying without new columns (status/reference)...");
        const basicInsertData = {
          owner_id: user.id,
          bucket: process.env.R2_BUCKET || "ai-videographer",
          object_key: objectKey,
          public_url: publicUrl,
          kind,
          filename,
          mime_type: mime,
          size_bytes: sizeBytes || null,
          duration_sec: durationSec || null,
          width: width || null,
          height: height || null,
          tags: tags || [],
          metadata: metadata || {},
        };
        
        const { data: retryAsset, error: retryError } = await supabase
          .from("media_assets")
          .insert(basicInsertData)
          .select()
          .single();
          
        if (retryError) {
          console.error("Retry also failed:", retryError);
          return NextResponse.json(
            { error: `Failed to save asset: ${retryError.message}` },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ asset: retryAsset });
      }
      
      return NextResponse.json(
        { error: `Failed to save asset: ${insertError.message}` },
        { status: 500 }
      );
    }

    // If generating description, trigger background processing
    if (generateDescription && asset) {
      // Fire and forget - don't wait for response
      const baseUrl = request.nextUrl.origin;
      fetch(`${baseUrl}/api/assets/${asset.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      }).catch(err => console.error('Background analysis trigger failed:', err));
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Error completing upload:", error);
    return NextResponse.json(
      { error: `Failed to complete upload: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

