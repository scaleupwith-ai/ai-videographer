import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Tags API - Controlled vocabulary management
 * 
 * GET - List all tags grouped by category
 * POST - Add a new tag (admin only)
 * DELETE - Remove a tag (admin only)
 */

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Category definitions for UI
const CATEGORIES = {
  subject: { label: "Subject", description: "What the clip is about" },
  setting: { label: "Setting", description: "Where it takes place" },
  industry: { label: "Industry", description: "Business vertical/niche" },
  action: { label: "Action", description: "What's happening" },
  mood: { label: "Mood", description: "Emotional tone" },
  camera: { label: "Camera", description: "Filming style/movement" },
  style: { label: "Style", description: "Visual aesthetic" },
  objects: { label: "Objects", description: "Notable items in frame" },
};

// GET - List all tags grouped by category
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    
    let query = supabase
      .from("tags")
      .select("*")
      .order("category")
      .order("name");
    
    if (category) {
      query = query.eq("category", category);
    }
    
    const { data: tags, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Group by category
    const grouped: Record<string, typeof tags> = {};
    for (const tag of tags || []) {
      if (!grouped[tag.category]) {
        grouped[tag.category] = [];
      }
      grouped[tag.category].push(tag);
    }
    
    return NextResponse.json({
      tags: tags || [],
      grouped,
      categories: CATEGORIES,
      totalCount: tags?.length || 0,
    });
  } catch (error) {
    console.error("Tags fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

// POST - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { name, category, description, color } = await request.json();
    
    if (!name || !category) {
      return NextResponse.json(
        { error: "name and category are required" },
        { status: 400 }
      );
    }
    
    // Validate category
    if (!Object.keys(CATEGORIES).includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${Object.keys(CATEGORIES).join(", ")}` },
        { status: 400 }
      );
    }
    
    // Normalize name to lowercase
    const normalizedName = name.toLowerCase().trim().replace(/\s+/g, "_");
    
    const { data: tag, error } = await supabase
      .from("tags")
      .insert({
        name: normalizedName,
        category,
        description: description || null,
        color: color || null,
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Tag already exists in this category" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ tag });
  } catch (error) {
    console.error("Tag creation error:", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}

// DELETE - Remove a tag
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Tag ID required" }, { status: 400 });
    }
    
    // First check if tag is used by any clips
    const { data: usageCount } = await supabase
      .from("clip_tags")
      .select("clip_id", { count: "exact" })
      .eq("tag_id", id);
    
    if (usageCount && usageCount.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete tag. It's used by ${usageCount.length} clips. Remove it from clips first.`,
          usageCount: usageCount.length,
        },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tag deletion error:", error);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}







