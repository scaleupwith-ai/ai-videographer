import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role client for admin operations
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data: voices, error } = await supabase
      .from("voices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching voices:", error);
      return NextResponse.json({ error: "Failed to fetch voices" }, { status: 500 });
    }

    return NextResponse.json({ voices });
  } catch (error) {
    console.error("Voices GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, eleven_labs_id, description, profile_image_url, preview_url } = await request.json();

    if (!name || !eleven_labs_id) {
      return NextResponse.json({ error: "Name and ElevenLabs ID are required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: voice, error } = await supabase
      .from("voices")
      .insert({
        name,
        eleven_labs_id,
        description,
        profile_image_url,
        preview_url,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating voice:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "A voice with this ElevenLabs ID already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to create voice" }, { status: 500 });
    }

    return NextResponse.json({ voice });
  } catch (error) {
    console.error("Voices POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

