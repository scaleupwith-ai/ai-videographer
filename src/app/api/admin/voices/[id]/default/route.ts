import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    // First, unset all defaults
    await supabase
      .from("voices")
      .update({ is_default: false })
      .eq("is_default", true);

    // Set the new default
    const { error } = await supabase
      .from("voices")
      .update({ is_default: true })
      .eq("id", id);

    if (error) {
      console.error("Error setting default voice:", error);
      return NextResponse.json({ error: "Failed to set default voice" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Voice default POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}







