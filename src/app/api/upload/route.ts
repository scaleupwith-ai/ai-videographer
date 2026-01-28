import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// POST - Upload a file to R2
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Determine folder based on content type
    let folder = "uploads";
    if (file.type.startsWith("image/")) {
      folder = "images";
    } else if (file.type.startsWith("audio/")) {
      folder = "audio";
    } else if (file.type.startsWith("video/")) {
      folder = "videos";
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "";
    const objectKey = `${folder}/${uuid()}${ext ? `.${ext}` : ""}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const url = `${process.env.R2_PUBLIC_BASE_URL}/${objectKey}`;

    return NextResponse.json({ url, objectKey, size: buffer.length });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}







