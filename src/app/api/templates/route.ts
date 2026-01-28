import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all public templates
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");
    
    let query = supabase
      .from("templates")
      .select("*")
      .eq("is_public", true)
      .order("use_count", { ascending: false });
    
    if (category) {
      query = query.eq("category", category);
    }
    
    if (featured === "true") {
      query = query.eq("is_featured", true);
    }

    const { data: templates, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}







