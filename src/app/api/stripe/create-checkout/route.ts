import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

const CREDIT_PRICE_AUD = 200; // $2.00 in cents

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { credits } = await request.json();

    if (!credits || credits < 1) {
      return NextResponse.json({ error: "Invalid credit amount" }, { status: 400 });
    }

    const amount = credits * CREDIT_PRICE_AUD;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `${credits} Video Credit${credits > 1 ? "s" : ""}`,
              description: `Purchase ${credits} video credit${credits > 1 ? "s" : ""} for AI Videographer`,
            },
            unit_amount: CREDIT_PRICE_AUD,
          },
          quantity: credits,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/app?payment=success&credits=${credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/signup?payment=cancelled`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        credits: credits.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

