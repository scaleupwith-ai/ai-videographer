import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Predefined categories with their purpose (for display in UI)
const TAG_CATEGORIES = {
  setting: "Where the footage takes place",
  mood: "Emotional tone and energy level",
  subject: "Main focus or topic",
  action: "What's happening in the clip",
  style: "Visual/filming style",
  industry: "Business sector or niche",
};

// GET - List all predefined clip tags grouped by category
export async function GET() {
  try {
    const supabase = getAdminSupabase();
    
    const { data: tags, error } = await supabase
      .from("clip_tags")
      .select("*")
      .order("category")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by category for easier UI rendering
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
      categories: Object.keys(TAG_CATEGORIES),
      categoryDescriptions: TAG_CATEGORIES,
    });
  } catch (error) {
    console.error("Error fetching clip tags:", error);
    return NextResponse.json({ error: "Failed to fetch clip tags" }, { status: 500 });
  }
}

// POST - Add a new tag
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { name, category, description, color } = await request.json();

    if (!name || !category || !description) {
      return NextResponse.json(
        { error: "name, category, and description are required" },
        { status: 400 }
      );
    }

    // Validate category
    if (!Object.keys(TAG_CATEGORIES).includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${Object.keys(TAG_CATEGORIES).join(", ")}` },
        { status: 400 }
      );
    }

    const { data: tag, error } = await supabase
      .from("clip_tags")
      .insert({
        name: name.toLowerCase().trim(),
        category,
        description,
        color: color || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Tag already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error("Error creating tag:", error);
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

    const { error } = await supabase
      .from("clip_tags")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}

