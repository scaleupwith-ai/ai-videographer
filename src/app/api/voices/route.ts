import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data: voices, error } = await supabase
      .from("voices")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name");

    if (error) {
      throw error;
    }

    return NextResponse.json({ voices: voices || [] });
  } catch (error) {
    console.error("Voices GET error:", error);
    return NextResponse.json({ error: "Failed to fetch voices" }, { status: 500 });
  }
}







