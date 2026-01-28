import { NextRequest, NextResponse } from "next/server";

// This endpoint proxies video metadata detection
// It fetches the video and returns duration from Content-Length and bitrate estimation
// For accurate duration, use FFprobe on the worker
export async function POST(request: NextRequest) {
  try {
    const { clipUrl, clipId } = await request.json();

    if (!clipUrl) {
      return NextResponse.json({ error: "clipUrl is required" }, { status: 400 });
    }

    // Try to get video metadata by fetching with range header
    // This is a rough estimate - for accurate duration, use FFprobe
    const response = await fetch(clipUrl, {
      method: "HEAD",
      headers: {
        "Range": "bytes=0-0",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ 
        error: "Failed to fetch video metadata",
        status: response.status,
      }, { status: 500 });
    }

    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type");
    
    // For accurate duration detection, we'd need FFprobe
    // This returns file info that can help estimate or be used for manual entry
    return NextResponse.json({
      clipId,
      contentLength: contentLength ? parseInt(contentLength) : null,
      contentType,
      // Rough estimate: assume ~5MB per 10 seconds for 4K video
      // This is very rough - user should verify
      estimatedDurationSec: contentLength 
        ? Math.round((parseInt(contentLength) / (5 * 1024 * 1024)) * 10) 
        : null,
      message: "Duration estimate based on file size. For accuracy, enter manually or use FFprobe.",
    });

  } catch (error) {
    console.error("Duration detection error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Detection failed" },
      { status: 500 }
    );
  }
}







