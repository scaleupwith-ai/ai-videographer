import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/**
 * Generate Embeddings for Clips
 * 
 * Creates semantic search embeddings for clips using OpenAI's text-embedding-3-small model.
 * The embedding is created from a combined "search text" that includes:
 * - Description
 * - Tags
 * - Resolution
 * - Any other relevant metadata
 * 
 * POST /api/admin/clips/generate-embeddings
 * Body: { clipIds?: string[], limit?: number, forceRegenerate?: boolean }
 */

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build search text from clip data
 * This is what gets embedded for semantic search
 */
function buildSearchText(clip: any): string {
  const parts: string[] = [];
  
  // Description is the most important
  if (clip.description) {
    parts.push(clip.description);
  }
  
  // Tags provide categorical context
  if (clip.tags && Array.isArray(clip.tags) && clip.tags.length > 0) {
    parts.push(`Tags: ${clip.tags.join(", ")}`);
  }
  
  // Resolution/quality info
  if (clip.source_resolution) {
    parts.push(`Resolution: ${clip.source_resolution}`);
  }
  
  // Duration context
  if (clip.duration_seconds) {
    const duration = clip.duration_seconds;
    if (duration < 5) {
      parts.push("Very short clip");
    } else if (duration < 15) {
      parts.push("Short clip");
    } else if (duration < 30) {
      parts.push("Medium length clip");
    } else {
      parts.push("Long clip");
    }
  }
  
  // Scene changes indicate complexity
  if (clip.scene_changes && Array.isArray(clip.scene_changes) && clip.scene_changes.length > 0) {
    parts.push(`${clip.scene_changes.length} scene changes (multiple shots)`);
  } else {
    parts.push("Single continuous shot");
  }
  
  return parts.join(". ");
}

/**
 * Generate embedding for a single text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  
  return response.data[0].embedding;
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
    const { 
      clipIds, 
      limit = 50, 
      forceRegenerate = false 
    } = body as {
      clipIds?: string[];
      limit?: number;
      forceRegenerate?: boolean;
    };
    
    // Fetch clips to process
    let query = adminSupabase
      .from("clips")
      .select("id, description, tags, source_resolution, duration_seconds, scene_changes, embedding_updated_at")
      .not("clip_link", "is", null);
    
    if (clipIds && clipIds.length > 0) {
      query = query.in("id", clipIds);
    } else if (!forceRegenerate) {
      // Only process clips without embeddings
      query = query.is("embedding", null);
    }
    
    query = query.limit(limit);
    
    const { data: clips, error: clipsError } = await query;
    
    if (clipsError) {
      console.error("[Embeddings] Query error:", clipsError);
      return NextResponse.json({ error: "Failed to fetch clips" }, { status: 500 });
    }
    
    if (!clips || clips.length === 0) {
      return NextResponse.json({ 
        message: "No clips to process",
        processed: 0 
      });
    }
    
    console.log(`[Embeddings] Processing ${clips.length} clips`);
    
    const results: Array<{
      clipId: string;
      success: boolean;
      searchTextLength?: number;
      error?: string;
    }> = [];
    
    // Process clips in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < clips.length; i += batchSize) {
      const batch = clips.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (clip) => {
        try {
          // Build search text
          const searchText = buildSearchText(clip);
          
          if (!searchText || searchText.length < 10) {
            results.push({
              clipId: clip.id,
              success: false,
              error: "Insufficient data to generate embedding",
            });
            return;
          }
          
          console.log(`[Embeddings] Generating for clip ${clip.id}: "${searchText.slice(0, 100)}..."`);
          
          // Generate embedding
          const embedding = await generateEmbedding(searchText);
          
          // Update the clip with embedding and search_text
          const { error: updateError } = await adminSupabase
            .from("clips")
            .update({ 
              embedding: embedding,
              search_text: searchText,
              embedding_updated_at: new Date().toISOString(),
            })
            .eq("id", clip.id);
          
          if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`);
          }
          
          results.push({
            clipId: clip.id,
            success: true,
            searchTextLength: searchText.length,
          });
          
        } catch (error) {
          console.error(`[Embeddings] Error processing clip ${clip.id}:`, error);
          results.push({
            clipId: clip.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }));
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < clips.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
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
    console.error("[Embeddings] Error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Embedding generation failed" 
    }, { status: 500 });
  }
}

/**
 * GET: Check status of embedding generation
 */
export async function GET(request: NextRequest) {
  try {
    const adminSupabase = getAdminSupabase();
    
    // Count clips with and without embeddings
    const [
      { count: totalClips },
      { count: withEmbeddings },
    ] = await Promise.all([
      adminSupabase.from("clips").select("*", { count: "exact", head: true }),
      adminSupabase.from("clips")
        .select("*", { count: "exact", head: true })
        .not("embedding", "is", null),
    ]);
    
    return NextResponse.json({
      totalClips: totalClips || 0,
      withEmbeddings: withEmbeddings || 0,
      withoutEmbeddings: (totalClips || 0) - (withEmbeddings || 0),
      percentComplete: totalClips ? Math.round(((withEmbeddings || 0) / totalClips) * 100) : 0,
    });
    
  } catch (error) {
    console.error("[Embeddings] Status error:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Status check failed" 
    }, { status: 500 });
  }
}







