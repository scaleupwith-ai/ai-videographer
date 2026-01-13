import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl, generateObjectKey } from "@/lib/r2/client";

export async function POST(request: NextRequest) {
  try {
    // Check R2 config
    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.error("R2 environment variables not configured");
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await request.json();
    const { filename, mime, kind } = body;

    if (!filename || !mime || !kind) {
      return NextResponse.json(
        { error: "Missing required fields: filename, mime, kind" },
        { status: 400 }
      );
    }

    // Generate unique object key
    const objectKey = generateObjectKey(user.id, kind, filename);
    console.log("Generating upload URL for:", objectKey);

    // Create presigned upload URL
    const uploadUrl = await createUploadUrl(objectKey, mime, 3600);
    console.log("Upload URL generated successfully");

    return NextResponse.json({
      uploadUrl,
      objectKey,
    });
  } catch (error) {
    console.error("Error creating upload URL:", error);
    return NextResponse.json(
      { error: `Failed to create upload URL: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

