import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all templates (admin view)
export async function GET() {
  try {
    const supabase = getAdminSupabase();
    
    const { data: templates, error } = await supabase
      .from("templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const { 
      title, 
      description, 
      category, 
      thumbnail_url, 
      preview_url,
      timeline_template, 
      variables,
      duration_sec,
      is_public,
      is_featured,
    } = body;

    if (!title || !timeline_template) {
      return NextResponse.json(
        { error: "title and timeline_template are required" },
        { status: 400 }
      );
    }

    const { data: template, error } = await supabase
      .from("templates")
      .insert({
        title,
        description,
        category: category || "general",
        thumbnail_url,
        preview_url,
        timeline_template,
        variables: variables || [],
        duration_sec,
        is_public: is_public ?? true,
        is_featured: is_featured ?? false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

// DELETE - Delete a template
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}







