import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

/**
 * Process Scene Detection for Clips
 * 
 * This endpoint runs FFmpeg scene detection on clips and stores the results.
 * Run this periodically or on-demand to analyze clips for scene changes.
 * 
 * POST /api/admin/clips/process-scenes
 * Body: { clipIds?: string[], limit?: number, threshold?: number }
 */

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface SceneChange {
  timestamp: number;
  score: number;
}

/**
 * Download a file from URL to local path
 */
async function downloadFile(url: string, localPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(localPath, buffer);
}

/**
 * Detect scene changes using FFmpeg
 */
async function detectSceneChanges(videoPath: string, threshold: number = 0.35): Promise<SceneChange[]> {
  return new Promise((resolve, reject) => {
    const scenes: SceneChange[] = [];
    
    const args = [
      "-i", videoPath,
      "-filter:v", `select='gt(scene,${threshold})',showinfo`,
      "-f", "null",
      "-"
    ];
    
    const ffmpeg = spawn("ffmpeg", args);
    
    let stderr = "";
    
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on("close", (code) => {
      const lines = stderr.split('\n');
      let currentTime = 0;
      
      for (const line of lines) {
        const ptsMatch = line.match(/pts_time:(\d+\.?\d*)/);
        if (ptsMatch) {
          currentTime = parseFloat(ptsMatch[1]);
        }
        
        const scoreMatch = line.match(/scene_score[=:](\d+\.?\d*)/);
        if (scoreMatch) {
          const score = parseFloat(scoreMatch[1]);
          if (score >= threshold) {
            scenes.push({
              timestamp: Math.round(currentTime * 100) / 100,
              score: Math.round(score * 1000) / 1000,
            });
          }
        }
      }
      
      // Remove duplicates
      const uniqueScenes = scenes.filter((scene, index, self) =>
        index === self.findIndex(s => Math.abs(s.timestamp - scene.timestamp) < 0.1)
      ).sort((a, b) => a.timestamp - b.timestamp);
      
      resolve(uniqueScenes);
    });
    
    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg failed: ${err.message}`));
    });
    
    setTimeout(() => {
      ffmpeg.kill();
      reject(new Error("Scene detection timed out"));
    }, 120000); // 2 minute timeout
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check for admin secret
    const authHeader = request.headers.get("authorization");
    const adminSecret = process.env.ADMIN_SECRET;
    
    if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const adminSupabase = getAdminSupabase();
    
    const body = await request.json();
    const { clipIds, limit = 10, threshold = 0.35 } = body as {
      clipIds?: string[];
      limit?: number;
      threshold?: number;
    };
    
    // Fetch clips to process
    let query = adminSupabase
      .from("clips")
      .select("id, clip_link, duration_seconds, scene_changes")
      .not("clip_link", "is", null);
    
    if (clipIds && clipIds.length > 0) {
      query = query.in("id", clipIds);
    } else {
      // Process clips that haven't been analyzed yet
      query = query
        .or("scene_changes.is.null,scene_changes.eq.[]")
        .limit(limit);
    }
    
    const { data: clips, error: clipsError } = await query;
    
    if (clipsError) {
      console.error("[Scene Detection] Query error:", clipsError);
      return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
    }
    
    if (!clips || clips.length === 0) {
      return NextResponse.json({ 
        message: "No clips to process",
        processed: 0 
      });
    }
    
    console.log(`[Scene Detection] Processing ${clips.length} clips`);
    
    const results: Array<{
      clipId: string;
      success: boolean;
      sceneCount?: number;
      error?: string;
    }> = [];
    
    for (const clip of clips) {
      const tempPath = join(tmpdir(), `scene-detect-${randomUUID()}.mp4`);
      
      try {
        console.log(`[Scene Detection] Processing clip ${clip.id}`);
        
        // Download the video
        await downloadFile(clip.clip_link!, tempPath);
        
        // Detect scene changes
        const sceneChanges = await detectSceneChanges(tempPath, threshold);
        
        console.log(`[Scene Detection] Found ${sceneChanges.length} scene changes in clip ${clip.id}`);
        
        // Update the clip in database
        const { error: updateError } = await adminSupabase
          .from("clips")
          .update({ scene_changes: sceneChanges })
          .eq("id", clip.id);
        
        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }
        
        results.push({
          clipId: clip.id,
          success: true,
          sceneCount: sceneChanges.length,
        });
        
      } catch (error) {
        console.error(`[Scene Detection] Error processing clip ${clip.id}:`, error);
        results.push({
          clipId: clip.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        // Clean up temp file
        try { await unlink(tempPath); } catch { /* ignore */ }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      processed: clips.length,
      successful: successCount,
      failed: clips.length - successCount,
      results,
    });
    
  } catch (error) {
    console.error("[Scene Detection] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Processing failed" 
    }, { status: 500 });
  }
}

/**
 * GET: Check status of scene detection processing
 */
export async function GET(request: NextRequest) {
  try {
    const adminSupabase = getAdminSupabase();
    
    // Count clips with and without scene detection
    const [
      { count: totalClips },
      { count: processedClips },
    ] = await Promise.all([
      adminSupabase.from("clips").select("*", { count: "exact", head: true }),
      adminSupabase.from("clips")
        .select("*", { count: "exact", head: true })
        .not("scene_changes", "is", null)
        .neq("scene_changes", "[]"),
    ]);
    
    return NextResponse.json({
      totalClips: totalClips || 0,
      processedClips: processedClips || 0,
      unprocessedClips: (totalClips || 0) - (processedClips || 0),
    });
    
  } catch (error) {
    console.error("[Scene Detection] Status error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Status check failed" 
    }, { status: 500 });
  }
}







