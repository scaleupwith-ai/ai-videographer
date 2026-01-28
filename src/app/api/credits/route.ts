import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user credits from user_profiles
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (error) {
      // If no profile exists, create one with default credits
      if (error.code === "PGRST116") {
        const { data: newProfile } = await supabase
          .from("user_profiles")
          .insert({ 
            id: user.id, 
            credits: 1,
            default_video_quality: '1080p',
          })
          .select("credits")
          .single();
        
        return NextResponse.json({ credits: newProfile?.credits || 1 });
      }
      
      // Try legacy user_credits table as fallback
      const { data: legacyCredits } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", user.id)
        .single();
      
      if (legacyCredits) {
        return NextResponse.json({ credits: legacyCredits.credits });
      }
      
      // Default to 1 credit
      return NextResponse.json({ credits: 1 });
    }

    return NextResponse.json({ credits: profile?.credits ?? 1 });
  } catch (error) {
    console.error("Credits GET error:", error);
    return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
  }
}
