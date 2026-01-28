import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/**
 * Semantic Search API for Clips
 * 
 * Performs hybrid search combining:
 * 1. Semantic similarity (vector search using embeddings)
 * 2. Exact filters (resolution, duration, orientation)
 * 3. Tag boosting (clips with matching tags get higher scores)
 * 
 * GET /api/clips/semantic-search?q=query&...filters
 * POST /api/clips/semantic-search { query, filters, boostTags }
 */

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface SearchFilters {
  minDuration?: number;
  maxDuration?: number;
  resolution?: string;
  requireTags?: string[];
  boostTags?: string[];
}

interface SearchResult {
  id: string;
  clip_link: string;
  description: string;
  tags: string[];
  duration_seconds: number;
  thumbnail_url: string;
  source_resolution: string;
  scene_changes: any[];
  similarity: number;
  tagBoost: number;
  finalScore: number;
}

/**
 * Generate embedding for query text
 */
async function embedQuery(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  return response.data[0].embedding;
}

/**
 * Fallback text search when embeddings aren't available
 */
async function textSearch(
  supabase: any,
  query: string,
  filters: SearchFilters,
  limit: number
): Promise<SearchResult[]> {
  let dbQuery = supabase
    .from("clips")
    .select("id, clip_link, description, tags, duration_seconds, thumbnail_url, source_resolution, scene_changes")
    .not("clip_link", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  
  // Apply filters
  if (filters.minDuration) {
    dbQuery = dbQuery.gte("duration_seconds", filters.minDuration);
  }
  if (filters.maxDuration) {
    dbQuery = dbQuery.lte("duration_seconds", filters.maxDuration);
  }
  if (filters.resolution) {
    dbQuery = dbQuery.eq("source_resolution", filters.resolution);
  }
  
  // Text search on description and tags
  if (query) {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (searchTerms.length > 0) {
      // Search in description OR tags
      const orConditions = searchTerms.map(term => 
        `description.ilike.%${term}%,tags.cs.{${term}}`
      ).join(",");
      dbQuery = dbQuery.or(orConditions);
    }
  }
  
  const { data: clips, error } = await dbQuery;
  
  if (error) {
    console.error("[Semantic Search] Text search error:", error);
    return [];
  }
  
  // Calculate simple text match scores
  return (clips || []).map((clip: any) => {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const descLower = (clip.description || "").toLowerCase();
    const tagsLower = (clip.tags || []).map((t: string) => t.toLowerCase());
    
    // Count matching terms
    let matchCount = 0;
    let tagBoost = 0;
    
    for (const term of queryTerms) {
      if (descLower.includes(term)) matchCount++;
      if (tagsLower.some((t: string) => t.includes(term))) {
        matchCount++;
        tagBoost += 0.1;
      }
    }
    
    const similarity = Math.min(matchCount / Math.max(queryTerms.length, 1), 1);
    
    return {
      ...clip,
      similarity,
      tagBoost,
      finalScore: similarity + tagBoost,
    };
  }).sort((a: SearchResult, b: SearchResult) => b.finalScore - a.finalScore);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "30");
    const threshold = parseFloat(searchParams.get("threshold") || "0.65");
    
    const filters: SearchFilters = {
      minDuration: searchParams.get("minDuration") ? parseFloat(searchParams.get("minDuration")!) : undefined,
      maxDuration: searchParams.get("maxDuration") ? parseFloat(searchParams.get("maxDuration")!) : undefined,
      resolution: searchParams.get("resolution") || undefined,
      boostTags: searchParams.get("boostTags")?.split(",").filter(Boolean) || undefined,
    };
    
    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }
    
    const adminSupabase = getAdminSupabase();
    
    // Check if we have embeddings
    const { count: embeddingCount } = await adminSupabase
      .from("clips")
      .select("*", { count: "exact", head: true })
      .not("embedding", "is", null);
    
    // If no embeddings, fall back to text search
    if (!embeddingCount || embeddingCount === 0) {
      console.log("[Semantic Search] No embeddings found, using text search fallback");
      const results = await textSearch(adminSupabase, query, filters, limit);
      return NextResponse.json({ 
        clips: results, 
        method: "text_search",
        message: "No embeddings available. Run generate-embeddings to enable semantic search.",
      });
    }
    
    // Generate query embedding
    console.log(`[Semantic Search] Embedding query: "${query}"`);
    const queryEmbedding = await embedQuery(query);
    
    // Use the PostgreSQL function for hybrid search with tag boosting
    const { data: clips, error } = await adminSupabase.rpc(
      "search_clips_hybrid_boosted",
      {
        query_embedding: queryEmbedding,
        boost_tags: filters.boostTags || null,
        match_threshold: threshold,
        match_count: limit,
        filter_min_duration: filters.minDuration || 0,
        filter_max_duration: filters.maxDuration || 9999,
        filter_resolution: filters.resolution || null,
        tag_boost_factor: 0.1,
      }
    );
    
    if (error) {
      console.error("[Semantic Search] Vector search error:", error);
      // Fall back to text search on error
      const results = await textSearch(adminSupabase, query, filters, limit);
      return NextResponse.json({ 
        clips: results, 
        method: "text_search_fallback",
        error: error.message,
      });
    }
    
    // Transform results
    const results: SearchResult[] = (clips || []).map((clip: any) => ({
      id: clip.id,
      clip_link: clip.clip_link,
      description: clip.description,
      tags: clip.tags,
      duration_seconds: clip.duration_seconds,
      thumbnail_url: clip.thumbnail_url,
      source_resolution: clip.source_resolution,
      scene_changes: clip.scene_changes,
      similarity: clip.base_similarity,
      tagBoost: clip.tag_boost,
      finalScore: clip.final_score,
    }));
    
    console.log(`[Semantic Search] Found ${results.length} clips for query: "${query}"`);
    
    return NextResponse.json({ 
      clips: results,
      method: "semantic_search",
      query,
      threshold,
    });
    
  } catch (error) {
    console.error("[Semantic Search] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Search failed" 
    }, { status: 500 });
  }
}

/**
 * POST for more complex searches with body parameters
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      query,
      limit = 30,
      threshold = 0.65,
      filters = {},
    } = body as {
      query: string;
      limit?: number;
      threshold?: number;
      filters?: SearchFilters;
    };
    
    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    
    const adminSupabase = getAdminSupabase();
    
    // Check if we have embeddings
    const { count: embeddingCount } = await adminSupabase
      .from("clips")
      .select("*", { count: "exact", head: true })
      .not("embedding", "is", null);
    
    if (!embeddingCount || embeddingCount === 0) {
      const results = await textSearch(adminSupabase, query, filters, limit);
      return NextResponse.json({ 
        clips: results, 
        method: "text_search",
      });
    }
    
    // Generate query embedding
    const queryEmbedding = await embedQuery(query);
    
    // Hybrid search with boosting
    const { data: clips, error } = await adminSupabase.rpc(
      "search_clips_hybrid_boosted",
      {
        query_embedding: queryEmbedding,
        boost_tags: filters.boostTags || null,
        match_threshold: threshold,
        match_count: limit,
        filter_min_duration: filters.minDuration || 0,
        filter_max_duration: filters.maxDuration || 9999,
        filter_resolution: filters.resolution || null,
        tag_boost_factor: 0.1,
      }
    );
    
    if (error) {
      console.error("[Semantic Search] Error:", error);
      const results = await textSearch(adminSupabase, query, filters, limit);
      return NextResponse.json({ 
        clips: results, 
        method: "text_search_fallback",
      });
    }
    
    const results: SearchResult[] = (clips || []).map((clip: any) => ({
      id: clip.id,
      clip_link: clip.clip_link,
      description: clip.description,
      tags: clip.tags,
      duration_seconds: clip.duration_seconds,
      thumbnail_url: clip.thumbnail_url,
      source_resolution: clip.source_resolution,
      scene_changes: clip.scene_changes,
      similarity: clip.base_similarity,
      tagBoost: clip.tag_boost,
      finalScore: clip.final_score,
    }));
    
    return NextResponse.json({ 
      clips: results,
      method: "semantic_search",
    });
    
  } catch (error) {
    console.error("[Semantic Search] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Search failed" 
    }, { status: 500 });
  }
}







