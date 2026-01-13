import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user credits
    const { data: credits, error } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (error) {
      // If no record exists, create one with default credits
      if (error.code === "PGRST116") {
        const { data: newCredits } = await supabase
          .from("user_credits")
          .insert({ user_id: user.id, credits: 3 })
          .select("credits")
          .single();
        
        return NextResponse.json({ credits: newCredits?.credits || 3 });
      }
      throw error;
    }

    return NextResponse.json({ credits: credits.credits });
  } catch (error) {
    console.error("Credits GET error:", error);
    return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
  }
}

