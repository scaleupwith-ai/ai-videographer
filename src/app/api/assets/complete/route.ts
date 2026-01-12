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
    const { objectKey, filename, mime, kind, sizeBytes, durationSec, width, height } = body;

    if (!objectKey || !filename || !mime || !kind) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get public URL for the asset
    const publicUrl = getPublicUrl(objectKey);

    // Insert asset into database
    const { data: asset, error: insertError } = await supabase
      .from("media_assets")
      .insert({
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
        tags: [],
        metadata: {},
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting asset:", insertError);
      return NextResponse.json(
        { error: "Failed to save asset" },
        { status: 500 }
      );
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Error completing upload:", error);
    return NextResponse.json(
      { error: "Failed to complete upload" },
      { status: 500 }
    );
  }
}

