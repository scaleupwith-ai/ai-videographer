import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase credentials");
  }
  
  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// POST - Batch update durations
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { updates } = await request.json() as { 
      updates: Array<{ clipId: string; duration: number }> 
    };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    console.log(`Updating ${updates.length} clip durations`);

    const results: Array<{ clipId: string; success: boolean; error?: string }> = [];

    for (const { clipId, duration } of updates) {
      if (!clipId || typeof duration !== "number" || duration <= 0) {
        results.push({ clipId, success: false, error: "Invalid data" });
        continue;
      }

      try {
        // Update clips table
        const { error: clipError } = await supabase
          .from("clips")
          .update({ duration_seconds: duration })
          .eq("id", clipId);

        if (clipError) {
          console.error(`Failed to update clip ${clipId}:`, clipError);
          results.push({ clipId, success: false, error: clipError.message });
          continue;
        }

        // Also update renditions
        const { error: renditionError } = await supabase
          .from("clip_renditions")
          .update({ duration_seconds: duration })
          .eq("clip_id", clipId);

        if (renditionError) {
          console.warn(`Failed to update renditions for ${clipId}:`, renditionError);
        }

        results.push({ clipId, success: true });
      } catch (err) {
        console.error(`Error updating clip ${clipId}:`, err);
        results.push({ clipId, success: false, error: "Unknown error" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Updated ${successCount} clips, ${failCount} failed`);

    return NextResponse.json({
      success: successCount,
      failed: failCount,
      results,
    });

  } catch (error) {
    console.error("Batch update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}







