import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { parseGDriveLink } from "@/lib/gdrive";
import type { Resolution } from "@/lib/database.types";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Valid resolution values
const VALID_RESOLUTIONS: Resolution[] = ['4k', '1080p', '720p'];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const minDuration = parseFloat(searchParams.get("minDuration") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");
    const resolution = searchParams.get("resolution") as Resolution | null;

    const adminSupabase = getAdminSupabase();

    // If resolution is specified and valid, try to use the RPC function
    if (resolution && VALID_RESOLUTIONS.includes(resolution)) {
      // Use the search_clips_by_resolution function if available
      const { data: rpcClips, error: rpcError } = await adminSupabase.rpc(
        'search_clips_by_resolution',
        {
          search_query: query || null,
          tag_filter: null,
          target_resolution: resolution,
          result_limit: limit,
        }
      );

      if (!rpcError && rpcClips) {
        // Filter by duration and transform
        const filteredClips = (rpcClips as Array<{
          id: string;
          clip_link: string;
          duration_seconds: number;
          description: string | null;
          tags: string[];
          thumbnail_url: string | null;
          resolution: string;
          width: number | null;
          height: number | null;
        }>)
          .filter(c => c.duration_seconds >= minDuration)
          .map(clip => {
            const { fileId } = parseGDriveLink(clip.clip_link);
            return {
              id: clip.id,
              clip_link: clip.clip_link,
              description: clip.description,
              tags: clip.tags,
              duration_seconds: clip.duration_seconds,
              thumbnail_url: clip.thumbnail_url,
              resolution: clip.resolution,
              width: clip.width,
              height: clip.height,
              previewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null,
            };
          });

        return NextResponse.json({ clips: filteredClips });
      }
      // If RPC fails (function doesn't exist yet), fall through to regular query
      console.warn("search_clips_by_resolution RPC failed, using fallback query:", rpcError?.message);
    }

    // Fallback: regular query without resolution filtering
    let dbQuery = adminSupabase
      .from("clips")
      .select("*")
      .gte("duration_seconds", minDuration)
      .order("created_at", { ascending: false })
      .limit(limit);

    // If there's a search query, filter by description or tags
    if (query) {
      dbQuery = dbQuery.or(`description.ilike.%${query}%,tags.cs.{${query}}`);
    }

    // If resolution is specified, filter by it directly
    if (resolution && VALID_RESOLUTIONS.includes(resolution)) {
      dbQuery = dbQuery.eq("resolution", resolution);
    }

    const { data: clips, error } = await dbQuery;

    if (error) {
      console.error("Clips search error:", error);
      return NextResponse.json({ error: "Failed to search clips" }, { status: 500 });
    }

    // Transform clips to include preview URLs and clip_link for selection
    const transformedClips = (clips || []).map(clip => {
      const { fileId } = parseGDriveLink(clip.clip_link);
      return {
        id: clip.id,
        clip_link: clip.clip_link,
        description: clip.description,
        tags: clip.tags,
        duration_seconds: clip.duration_seconds,
        thumbnail_url: clip.thumbnail_url,
        resolution: clip.resolution || '1080p',
        width: clip.width,
        height: clip.height,
        previewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null,
      };
    });

    return NextResponse.json({ clips: transformedClips });
  } catch (error) {
    console.error("Clips search error:", error);
    return NextResponse.json(
      { error: "Failed to search clips" },
      { status: 500 }
    );
  }
}

