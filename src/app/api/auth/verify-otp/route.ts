import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Find the OTP
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("verified", false)
      .single();

    if (fetchError || !otpRecord) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      // Delete expired OTP
      await supabase.from("otp_codes").delete().eq("id", otpRecord.id);
      return NextResponse.json({ error: "Verification code has expired" }, { status: 400 });
    }

    // Mark as verified
    await supabase
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    return NextResponse.json({ success: true, message: "Email verified" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

