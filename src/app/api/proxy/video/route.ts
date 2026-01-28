import { NextRequest, NextResponse } from "next/server";

// Proxy for video files - needed for R2 signed URLs or CORS issues
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Fetch the video
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status }
      );
    }

    // Get content type
    const contentType = response.headers.get("content-type") || "video/mp4";

    // Stream the response
    const body = response.body;
    if (!body) {
      return NextResponse.json({ error: "No response body" }, { status: 500 });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Video proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy video" },
      { status: 500 }
    );
  }
}







