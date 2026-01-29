import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const supabase = createAdminClient();
    
    // Delete any existing OTPs for this email
    await supabase.from("otp_codes").delete().eq("email", email);

    // Insert new OTP
    const { error: insertError } = await supabase.from("otp_codes").insert({
      email,
      code: otp,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return NextResponse.json({ error: "Failed to generate verification code" }, { status: 500 });
    }

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.log("DEV MODE: OTP for", email, "is", otp);
      return NextResponse.json({ 
        success: true,
        message: "Verification code sent (dev mode - check console)"
      });
    }

    // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "AI Videographer <noreply@resend.dev>",
      to: email,
      subject: "Your verification code for AI Videographer",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #06b6d4, #3b82f6); border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 24px; color: white;">🎬</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; color: #18181b;">AI Videographer</h1>
            </div>
            
            <p style="color: #52525b; margin-bottom: 20px;">Here's your verification code:</p>
            
            <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${otp}</span>
            </div>
            
            <p style="color: #71717a; font-size: 14px; margin-bottom: 0;">
              This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Failed to send email:", emailError);
      return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Verification code sent" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


