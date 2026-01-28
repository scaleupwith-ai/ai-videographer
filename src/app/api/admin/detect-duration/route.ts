import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

// Detect duration of audio/video file from URL
async function getDurationFromUrl(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      url,
    ]);

    let output = "";
    let error = "";

    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      error += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0 && output.trim()) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? null : Math.round(duration * 100) / 100);
      } else {
        console.error("ffprobe error:", error);
        resolve(null);
      }
    });

    ffprobe.on("error", () => {
      resolve(null);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      ffprobe.kill();
      resolve(null);
    }, 30000);
  });
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const duration = await getDurationFromUrl(url);

    if (duration === null) {
      return NextResponse.json({ error: "Could not detect duration" }, { status: 500 });
    }

    return NextResponse.json({ duration });
  } catch (error) {
    console.error("Error detecting duration:", error);
    return NextResponse.json({ error: "Failed to detect duration" }, { status: 500 });
  }
}







