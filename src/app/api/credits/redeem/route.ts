import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = getAdminClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();
    
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const trimmedCode = code.trim().toUpperCase();

    // Find the promo code
    const { data: promoCode, error: codeError } = await adminSupabase
      .from("promo_codes")
      .select("*")
      .eq("code", trimmedCode)
      .eq("is_active", true)
      .single();

    if (codeError || !promoCode) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    // Check if code has expired
    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return NextResponse.json({ error: "This code has expired" }, { status: 400 });
    }

    // Check if max uses reached
    if (promoCode.max_uses !== null && promoCode.current_uses >= promoCode.max_uses) {
      return NextResponse.json({ error: "This code has reached its usage limit" }, { status: 400 });
    }

    // Check if user already redeemed this code
    const { data: existingRedemption } = await adminSupabase
      .from("code_redemptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("promo_code_id", promoCode.id)
      .single();

    if (existingRedemption) {
      return NextResponse.json({ error: "You have already used this code" }, { status: 400 });
    }

    // Start transaction: Add credits, record redemption, update promo code usage
    
    // 1. Get or create user credits
    let { data: userCredits } = await adminSupabase
      .from("user_credits")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!userCredits) {
      const { data: newCredits } = await adminSupabase
        .from("user_credits")
        .insert({ user_id: user.id, credits: 0 })
        .select()
        .single();
      userCredits = newCredits;
    }

    // 2. Add credits
    const newCreditAmount = (userCredits?.credits || 0) + promoCode.credits;
    await adminSupabase
      .from("user_credits")
      .update({ credits: newCreditAmount, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // 3. Record redemption
    await adminSupabase
      .from("code_redemptions")
      .insert({
        user_id: user.id,
        promo_code_id: promoCode.id,
        credits_granted: promoCode.credits,
      });

    // 4. Record transaction
    await adminSupabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: promoCode.credits,
        type: "promo_code",
        description: `Redeemed code: ${trimmedCode}`,
        reference_id: promoCode.id,
      });

    // 5. Update promo code usage count
    await adminSupabase
      .from("promo_codes")
      .update({ current_uses: promoCode.current_uses + 1 })
      .eq("id", promoCode.id);

    return NextResponse.json({
      success: true,
      creditsAdded: promoCode.credits,
      newBalance: newCreditAmount,
    });
  } catch (error) {
    console.error("Redeem code error:", error);
    return NextResponse.json({ error: "Failed to redeem code" }, { status: 500 });
  }
}







