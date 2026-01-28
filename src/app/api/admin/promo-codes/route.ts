import { NextRequest, NextResponse } from "next/server";
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

    const { data: codes, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ codes: codes || [] });
  } catch (error) {
    console.error("Promo codes GET error:", error);
    return NextResponse.json({ error: "Failed to fetch promo codes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code, credits, max_uses, expires_at } = await request.json();

    if (!code || !credits) {
      return NextResponse.json({ error: "Code and credits are required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: promoCode, error } = await supabase
      .from("promo_codes")
      .insert({
        code: code.trim().toUpperCase(),
        credits: parseInt(credits),
        max_uses: max_uses ? parseInt(max_uses) : null,
        expires_at: expires_at || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A code with this name already exists" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ promoCode });
  } catch (error) {
    console.error("Promo code POST error:", error);
    return NextResponse.json({ error: "Failed to create promo code" }, { status: 500 });
  }
}







