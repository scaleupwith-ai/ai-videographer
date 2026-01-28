import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/**
 * Clip Retrieval API
 * 
 * This API retrieves a SHORTLIST of relevant clips based on:
 * - Semantic search (vector similarity using embeddings) - PRIMARY
 * - Tags (weighted by match count) - SECONDARY
 * - Text search (description/keywords) - FALLBACK
 * - Resolution filter
 * 
 * CRITICAL: This API exists so we NEVER send the full clip database to AI.
 * AI only sees the shortlist returned by this endpoint (max 200 clips).
 */

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate embedding for semantic search
 */
async function embedQuery(query: string): Promise<number[] | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("[Clip Retrieval] Embedding error:", error);
    return null;
  }
}

interface RetrieveRequest {
  // Tag IDs to filter by (clips must have at least some of these)
  tagIds?: string[];
  // Tag names to filter by (alternative to IDs)
  tagNames?: string[];
  // Free text search query
  query?: string;
  // Required resolution (4k, 1080p, 720p)
  resolution?: string;
  // Maximum clips to return (default 100, max 200)
  limit?: number;
  // Minimum duration in seconds
  minDuration?: number;
  // Maximum duration in seconds
  maxDuration?: number;
  // Industry/category filter
  industry?: string;
}

interface ClipForAI {
  id: string;
  duration: number;
  description: string;
  tags: string[]; // Just tag names, max 10
  resolution: string;
  clip_link: string; // URL to the video file
  scene_changes?: Array<{ timestamp: number; score: number }>; // For AI-aware transitions
  score?: number; // Relevance score for debugging
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const body: RetrieveRequest = await request.json();
    
    const {
      tagIds = [],
      tagNames = [],
      query,
      resolution = "1080p",
      limit = 100,
      minDuration,
      maxDuration,
      industry,
    } = body;
    
    // Cap limit at 200 for AI context management
    const safeLimit = Math.min(limit, 200);
    
    console.log(`[Clip Retrieval] Tags: ${tagNames.length || tagIds.length}, Query: "${query}", Resolution: ${resolution}, Limit: ${safeLimit}`);
    
    // ========================================================================
    // STEP 1: Get tag IDs if names were provided
    // ========================================================================
    let searchTagIds = [...tagIds];
    
    if (tagNames.length > 0) {
      const { data: foundTags } = await supabase
        .from("tags")
        .select("id, name")
        .in("name", tagNames.map(n => n.toLowerCase()));
      
      if (foundTags) {
        searchTagIds.push(...foundTags.map(t => t.id));
      }
    }
    
    // If industry is specified, add industry tag
    if (industry) {
      const { data: industryTag } = await supabase
        .from("tags")
        .select("id")
        .eq("name", industry.toLowerCase())
        .eq("category", "industry")
        .single();
      
      if (industryTag) {
        searchTagIds.push(industryTag.id);
      }
    }
    
    // ========================================================================
    // STEP 2: Build the query - Semantic search first, then tags, then text
    // ========================================================================
    
    let clipIds: string[] = [];
    let clipScores: Map<string, number> = new Map();
    let usedSemanticSearch = false;
    
    // SEMANTIC SEARCH - Primary method when query is provided
    if (query && query.trim()) {
      // Check if we have embeddings available
      const { count: embeddingCount } = await supabase
        .from("clips")
        .select("*", { count: "exact", head: true })
        .not("embedding", "is", null);
      
      if (embeddingCount && embeddingCount > 0) {
        console.log(`[Clip Retrieval] Using semantic search (${embeddingCount} clips have embeddings)`);
        
        // Generate query embedding
        const queryEmbedding = await embedQuery(query);
        
        if (queryEmbedding) {
          // Get tag names for boosting
          const boostTagNames = searchTagIds.length > 0 ? (
            await supabase
              .from("tags")
              .select("name")
              .in("id", searchTagIds)
          ).data?.map(t => t.name) : null;
          
          // Use hybrid search with tag boosting
          const { data: semanticResults, error: semanticError } = await supabase.rpc(
            "search_clips_hybrid_boosted",
            {
              query_embedding: queryEmbedding,
              boost_tags: boostTagNames,
              match_threshold: 0.6,
              match_count: safeLimit * 2,
              filter_min_duration: minDuration || 0,
              filter_max_duration: maxDuration || 9999,
              filter_resolution: resolution || null,
              tag_boost_factor: 0.15,
            }
          );
          
          if (!semanticError && semanticResults && semanticResults.length > 0) {
            usedSemanticSearch = true;
            clipIds = semanticResults.map((r: any) => r.id);
            semanticResults.forEach((r: any) => clipScores.set(r.id, r.final_score * 10));
            console.log(`[Clip Retrieval] Semantic search found ${clipIds.length} clips`);
          } else if (semanticError) {
            console.error(`[Clip Retrieval] Semantic search error:`, semanticError);
          }
        }
      }
    }
    
    // FALLBACK: Tag-based search if semantic search didn't work or wasn't used
    if (!usedSemanticSearch && searchTagIds.length > 0) {
      const { data: tagMatches } = await supabase
        .from("clip_tags")
        .select("clip_id, tag_id")
        .in("tag_id", searchTagIds);
      
      if (tagMatches) {
        // Count matches per clip
        const matchCounts = new Map<string, number>();
        for (const match of tagMatches) {
          matchCounts.set(match.clip_id, (matchCounts.get(match.clip_id) || 0) + 1);
        }
        
        // Sort by match count (descending)
        const sortedClips = Array.from(matchCounts.entries())
          .sort((a, b) => b[1] - a[1]);
        
        clipIds = sortedClips.map(([id]) => id);
        sortedClips.forEach(([id, score]) => clipScores.set(id, score));
        
        console.log(`[Clip Retrieval] Tag search found ${clipIds.length} clips matching ${searchTagIds.length} tags`);
      }
    }
    
    // FALLBACK: Text search if semantic and tag search didn't work
    if (!usedSemanticSearch && query && query.trim() && clipIds.length === 0) {
      console.log(`[Clip Retrieval] Falling back to text search`);
      
      // Search in descriptions with ilike (more flexible than text search)
      const searchTerms = query.trim().toLowerCase().split(/\s+/);
      
      for (const term of searchTerms.slice(0, 5)) {
        const { data: textMatches } = await supabase
          .from("clips")
          .select("id")
          .or(`description.ilike.%${term}%,tags.cs.{${term}}`)
          .limit(50);
        
        if (textMatches && textMatches.length > 0) {
          for (const match of textMatches) {
            if (!clipIds.includes(match.id)) {
              clipIds.push(match.id);
              clipScores.set(match.id, 1);
            } else {
              clipScores.set(match.id, (clipScores.get(match.id) || 0) + 0.5);
            }
          }
        }
      }
      
      // Also search keywords table
      const { data: keywordMatches } = await supabase
        .from("clip_keywords")
        .select("clip_id")
        .ilike("keyword", `%${query.trim()}%`);
      
      if (keywordMatches && keywordMatches.length > 0) {
        for (const match of keywordMatches) {
          if (!clipIds.includes(match.clip_id)) {
            clipIds.push(match.clip_id);
            clipScores.set(match.clip_id, 0.5);
          } else {
            clipScores.set(match.clip_id, (clipScores.get(match.clip_id) || 0) + 0.5);
          }
        }
      }
      
      console.log(`[Clip Retrieval] Text search found ${clipIds.length} clips`);
    }
    
    // If no filters provided, get all clips (will be limited later)
    if (clipIds.length === 0 && searchTagIds.length === 0 && !query) {
      const { data: allClips } = await supabase
        .from("clips")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(safeLimit * 2); // Get more than needed for filtering
      
      if (allClips) {
        clipIds = allClips.map(c => c.id);
      }
    }
    
    // ========================================================================
    // STEP 3: Filter by resolution using renditions table
    // ========================================================================
    if (clipIds.length > 0 && resolution) {
      const { data: renditions } = await supabase
        .from("clip_renditions")
        .select("clip_id")
        .in("clip_id", clipIds)
        .eq("resolution", resolution);
      
      if (renditions && renditions.length > 0) {
        const renditionClipIds = new Set(renditions.map(r => r.clip_id));
        clipIds = clipIds.filter(id => renditionClipIds.has(id));
        console.log(`[Clip Retrieval] ${clipIds.length} clips at ${resolution} resolution`);
      } else {
        // Fallback: use source clips if no renditions exist
        console.log(`[Clip Retrieval] No renditions found, using source clips`);
      }
    }
    
    // ========================================================================
    // STEP 4: Fetch clip details for the shortlist
    // ========================================================================
    
    // Sort by score and limit
    const sortedClipIds = clipIds
      .sort((a, b) => (clipScores.get(b) || 0) - (clipScores.get(a) || 0))
      .slice(0, safeLimit);
    
    if (sortedClipIds.length === 0) {
      return NextResponse.json({
        clips: [],
        totalFound: 0,
        message: "No clips found matching criteria",
      });
    }
    
    // Fetch clip details (including clip_link for the worker and scene_changes for AI)
    const { data: clips, error: clipError } = await supabase
      .from("clips")
      .select("id, description, duration_seconds, source_resolution, clip_link, scene_changes")
      .in("id", sortedClipIds);
    
    if (clipError || !clips) {
      throw new Error(clipError?.message || "Failed to fetch clips");
    }
    
    // Filter by duration if specified
    let filteredClips = clips;
    if (minDuration !== undefined) {
      filteredClips = filteredClips.filter(c => c.duration_seconds >= minDuration);
    }
    if (maxDuration !== undefined) {
      filteredClips = filteredClips.filter(c => c.duration_seconds <= maxDuration);
    }
    
    // Fetch tags for each clip (limited to 10 per clip)
    const { data: clipTagsData } = await supabase
      .from("clip_tags")
      .select(`
        clip_id,
        tag:tags(name)
      `)
      .in("clip_id", filteredClips.map(c => c.id));
    
    // Group tags by clip
    const tagsByClip = new Map<string, string[]>();
    if (clipTagsData) {
      for (const ct of clipTagsData) {
        const existing = tagsByClip.get(ct.clip_id) || [];
        if (ct.tag && existing.length < 10) {
          existing.push((ct.tag as any).name);
        }
        tagsByClip.set(ct.clip_id, existing);
      }
    }
    
    // ========================================================================
    // STEP 5: Format for AI consumption
    // ========================================================================
    const clipsForAI: ClipForAI[] = filteredClips.map(clip => ({
      id: clip.id,
      duration: clip.duration_seconds,
      description: clip.description?.slice(0, 100) || "No description", // Truncate for AI
      tags: tagsByClip.get(clip.id) || [],
      resolution: clip.source_resolution || "1080p",
      clip_link: clip.clip_link,
      scene_changes: clip.scene_changes || undefined,
      score: clipScores.get(clip.id),
    }));
    
    // Sort by score (highest first)
    clipsForAI.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    console.log(`[Clip Retrieval] Returning ${clipsForAI.length} clips for AI (method: ${usedSemanticSearch ? "semantic" : "text/tag"})`);
    
    return NextResponse.json({
      clips: clipsForAI,
      totalFound: clipsForAI.length,
      resolution,
      searchMethod: usedSemanticSearch ? "semantic" : "text_tag",
      filters: {
        tagCount: searchTagIds.length,
        hasQuery: !!query,
        minDuration,
        maxDuration,
      },
    });
    
  } catch (error) {
    console.error("Clip retrieval error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retrieve clips" },
      { status: 500 }
    );
  }
}

