import { spawn } from "child_process";

export interface SceneChange {
  timestamp: number;
  score: number;
}

/**
 * Detect scene changes in a video using FFmpeg
 * 
 * Uses FFmpeg's scene detection filter which measures the difference
 * between consecutive frames. A high score indicates a scene change.
 * 
 * @param videoPath - Path to the video file
 * @param threshold - Scene detection threshold (0-1). Lower = more sensitive. Default 0.35
 * @returns Array of scene changes with timestamps and scores
 */
export async function detectSceneChanges(
  videoPath: string,
  threshold: number = 0.35
): Promise<SceneChange[]> {
  return new Promise((resolve, reject) => {
    const scenes: SceneChange[] = [];
    
    // FFmpeg command to detect scene changes
    // -filter:v "select='gt(scene,threshold)',showinfo" outputs info for frames exceeding threshold
    const args = [
      "-i", videoPath,
      "-filter:v", `select='gt(scene,${threshold})',showinfo`,
      "-f", "null",
      "-"
    ];
    
    console.log(`[Scene Detection] Running: ffmpeg ${args.join(" ")}`);
    
    const ffmpeg = spawn("ffmpeg", args);
    
    let stderr = "";
    
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on("close", (code) => {
      // FFmpeg outputs scene info to stderr
      // Parse lines like: [Parsed_showinfo_1 @ 0x...] n:   0 pts:      0 pts_time:0       ...
      // and: [Parsed_select_0 @ 0x...] scene_score:0.423456
      
      const lines = stderr.split('\n');
      let currentTime = 0;
      
      for (const line of lines) {
        // Extract pts_time (timestamp)
        const ptsMatch = line.match(/pts_time:(\d+\.?\d*)/);
        if (ptsMatch) {
          currentTime = parseFloat(ptsMatch[1]);
        }
        
        // Extract scene_score
        const scoreMatch = line.match(/scene_score[=:](\d+\.?\d*)/);
        if (scoreMatch) {
          const score = parseFloat(scoreMatch[1]);
          // Only include if score exceeds threshold (filter might not be perfect)
          if (score >= threshold) {
            scenes.push({
              timestamp: Math.round(currentTime * 100) / 100, // Round to 2 decimal places
              score: Math.round(score * 1000) / 1000, // Round to 3 decimal places
            });
          }
        }
      }
      
      // Remove duplicates and sort by timestamp
      const uniqueScenes = scenes.filter((scene, index, self) =>
        index === self.findIndex(s => Math.abs(s.timestamp - scene.timestamp) < 0.1)
      ).sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`[Scene Detection] Found ${uniqueScenes.length} scene changes`);
      resolve(uniqueScenes);
    });
    
    ffmpeg.on("error", (err) => {
      console.error("[Scene Detection] FFmpeg error:", err);
      reject(new Error(`FFmpeg failed: ${err.message}`));
    });
    
    // Set timeout to prevent hanging
    setTimeout(() => {
      ffmpeg.kill();
      reject(new Error("Scene detection timed out"));
    }, 60000); // 60 second timeout
  });
}

/**
 * Get clean cut points from scene changes
 * Returns timestamps that are good for cutting (avoiding cuts mid-scene)
 * 
 * @param sceneChanges - Array of detected scene changes
 * @param minGap - Minimum gap between cut points in seconds
 * @returns Array of recommended cut timestamps
 */
export function getCleanCutPoints(
  sceneChanges: SceneChange[],
  minGap: number = 2
): number[] {
  if (sceneChanges.length === 0) return [];
  
  const cutPoints: number[] = [];
  let lastCut = -minGap;
  
  for (const scene of sceneChanges) {
    if (scene.timestamp - lastCut >= minGap) {
      cutPoints.push(scene.timestamp);
      lastCut = scene.timestamp;
    }
  }
  
  return cutPoints;
}

/**
 * Split a clip duration into segments based on scene changes
 * Useful for telling AI where natural edit points are
 * 
 * @param duration - Total clip duration
 * @param sceneChanges - Detected scene changes
 * @returns Array of segments with start/end times
 */
export function getSceneSegments(
  duration: number,
  sceneChanges: SceneChange[]
): Array<{ start: number; end: number; duration: number }> {
  const segments: Array<{ start: number; end: number; duration: number }> = [];
  
  let start = 0;
  for (const scene of sceneChanges) {
    if (scene.timestamp > start) {
      segments.push({
        start,
        end: scene.timestamp,
        duration: scene.timestamp - start,
      });
      start = scene.timestamp;
    }
  }
  
  // Add final segment
  if (start < duration) {
    segments.push({
      start,
      end: duration,
      duration: duration - start,
    });
  }
  
  return segments;
}







