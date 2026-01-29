import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Fetch user settings
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create settings
    let { data: settings, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // No settings exist, create default
      const { data: newSettings, error: createError } = await supabase
        .from("user_settings")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      settings = newSettings;
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch intro/outro assets if they exist
    let introAsset = null;
    let outroAsset = null;

    if (settings?.intro_asset_id) {
      const { data } = await supabase
        .from("media_assets")
        .select("id, filename, public_url, duration_sec")
        .eq("id", settings.intro_asset_id)
        .single();
      introAsset = data;
    }

    if (settings?.outro_asset_id) {
      const { data } = await supabase
        .from("media_assets")
        .select("id, filename, public_url, duration_sec")
        .eq("id", settings.outro_asset_id)
        .single();
      outroAsset = data;
    }

    return NextResponse.json({ settings, introAsset, outroAsset });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// POST - Update user settings
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Fields that can be updated
    const allowedFields = [
      "intro_asset_id",
      "outro_asset_id",
      "always_use_intro",
      "always_use_outro",
      "default_caption_words_per_block",
      "default_caption_font",
      "default_caption_style",
      "default_music_volume",
      "default_voiceover_volume",
      "default_resolution",
      // Brand colors for effects
      "brand_primary_color",
      "brand_secondary_color", 
      "brand_accent_color",
    ];

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Upsert settings
    const { data: settings, error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        ...updates,
      }, {
        onConflict: "user_id",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}







