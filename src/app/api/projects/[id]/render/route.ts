import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { enqueueRenderJob } from "@/lib/queue/render";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user credits - create if not exists
    let { data: userCredits } = await adminSupabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    // If no credits record exists, create one with 3 free credits
    if (!userCredits) {
      const { data: newCredits } = await adminSupabase
        .from("user_credits")
        .insert({ user_id: user.id, credits: 3 })
        .select("credits")
        .single();
      userCredits = newCredits;
    }

    const currentCredits = userCredits?.credits ?? 0;

    if (currentCredits < 1) {
      return NextResponse.json(
        { error: "Insufficient credits. You need at least 1 credit to render a video." },
        { status: 402 }
      );
    }

    // Get project
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.timeline_json) {
      return NextResponse.json(
        { error: "Project has no timeline. Generate a plan first." },
        { status: 400 }
      );
    }

    // Check if there's already a running render job
    const { data: existingJob } = await supabase
      .from("render_jobs")
      .select("*")
      .eq("project_id", id)
      .in("status", ["queued", "running"])
      .single();

    if (existingJob) {
      return NextResponse.json(
        { error: "A render job is already in progress", job: existingJob },
        { status: 409 }
      );
    }

    // Deduct 1 credit
    await adminSupabase
      .from("user_credits")
      .update({ credits: currentCredits - 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // Record the transaction
    await adminSupabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -1,
        type: "render",
        description: `Render: ${project.title}`,
        reference_id: id,
      });

    // Create render job record
    const { data: job, error: jobError } = await supabase
      .from("render_jobs")
      .insert({
        project_id: id,
        status: "queued",
        progress: 0,
        logs: ["Render job created"],
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Error creating render job:", jobError);
      return NextResponse.json(
        { error: "Failed to create render job" },
        { status: 500 }
      );
    }

    // Update project status
    await supabase
      .from("projects")
      .update({ status: "rendering" })
      .eq("id", id);

    // Enqueue the render job for the worker
    try {
      await enqueueRenderJob({
        jobId: job.id,
        projectId: id,
      });
    } catch (queueError) {
      console.error("Error enqueueing render job:", queueError);
      // Update job status to failed
      await supabase
        .from("render_jobs")
        .update({
          status: "failed",
          error: "Failed to enqueue job",
        })
        .eq("id", job.id);

      await supabase
        .from("projects")
        .update({ status: "failed" })
        .eq("id", id);

      return NextResponse.json(
        { error: "Failed to enqueue render job" },
        { status: 500 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error starting render:", error);
    return NextResponse.json(
      { error: "Failed to start render" },
      { status: 500 }
    );
  }
}

