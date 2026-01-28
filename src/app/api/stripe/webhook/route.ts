import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || "0", 10);

      if (userId && credits > 0) {
        // Record payment
        await supabase.from("payment_history").insert({
          user_id: userId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
          amount_cents: session.amount_total || 0,
          currency: session.currency || "aud",
          credits_purchased: credits,
          status: "completed",
        });

        // Add credits to user profile
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("credits")
          .eq("id", userId)
          .single();

        const currentCredits = profile?.credits || 0;

        await supabase
          .from("user_profiles")
          .update({
            credits: currentCredits + credits,
            onboarding_completed: true,
          })
          .eq("id", userId);

        console.log(`Added ${credits} credits to user ${userId}`);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || "0", 10);

      if (userId && credits > 0) {
        // Record failed payment
        await supabase.from("payment_history").insert({
          user_id: userId,
          stripe_checkout_session_id: session.id,
          amount_cents: session.amount_total || 0,
          currency: session.currency || "aud",
          credits_purchased: credits,
          status: "failed",
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

