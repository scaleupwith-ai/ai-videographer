import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch payment history
    const { data: payments, error } = await supabase
      .from("payment_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching payments:", error);
      return NextResponse.json({ payments: [] });
    }

    return NextResponse.json({ payments: payments || [] });
  } catch (error) {
    console.error("Payments API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

