import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();

    const { error } = await supabase
      .from("voices")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting voice:", error);
      return NextResponse.json({ error: "Failed to delete voice" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Voice DELETE error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

