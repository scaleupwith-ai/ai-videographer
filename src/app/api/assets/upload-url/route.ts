import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl, generateObjectKey } from "@/lib/r2/client";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Create presigned upload URL
    const uploadUrl = await createUploadUrl(objectKey, mime, 3600);

    return NextResponse.json({
      uploadUrl,
      objectKey,
    });
  } catch (error) {
    console.error("Error creating upload URL:", error);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    );
  }
}

