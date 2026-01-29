import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import { AgentJob, AgentJobInput, AgentJobType } from "@/lib/agent/types";
import { processAgentJob } from "@/lib/agent/processor";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/agent/jobs - Create a new agent job
 * 
 * The job is created and immediately starts processing in the background.
 * User can close browser and job will continue.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const { type, input, notifyOnComplete, notifyEmail } = body as {
      type: AgentJobType;
      input: AgentJobInput;
      notifyOnComplete?: boolean;
      notifyEmail?: string;
    };
    
    // Validate required fields
    if (!type || !input?.description) {
      return NextResponse.json({ error: "Type and description are required" }, { status: 400 });
    }
    
    // Create job in database
    const jobId = uuid();
    const adminSupabase = getAdminSupabase();
    
    const job: AgentJob = {
      id: jobId,
      userId: user.id,
      type,
      status: 'queued',
      progress: 0,
      input,
      state: {},
      createdAt: new Date().toISOString(),
      notifyOnComplete: notifyOnComplete || false,
      notifyEmail: notifyEmail || user.email,
    };
    
    const { error: insertError } = await adminSupabase
      .from("agent_jobs")
      .insert({
        id: job.id,
        user_id: job.userId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        input: job.input,
        state: job.state,
        created_at: job.createdAt,
        notify_on_complete: job.notifyOnComplete,
        notify_email: job.notifyEmail,
      });
      
    if (insertError) {
      console.error("[Agent] Failed to create job:", insertError);
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }
    
    // Start processing in background (fire-and-forget)
    // Note: In production, this would be handled by a proper queue system
    // For now, we use a non-blocking internal call
    processAgentJobBackground(job);
    
    return NextResponse.json({
      jobId: job.id,
      status: 'queued',
      message: "Job created and processing started. You can close this browser - we'll notify you when it's ready.",
    });
    
  } catch (error) {
    console.error("[Agent] Error creating job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create job" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent/jobs - List user's agent jobs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const status = url.searchParams.get("status");
    
    let query = supabase
      .from("agent_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
      
    if (status) {
      query = query.eq("status", status);
    }
    
    const { data: jobs, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ jobs: jobs || [] });
    
  } catch (error) {
    console.error("[Agent] Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

/**
 * Process job in background without blocking
 */
function processAgentJobBackground(job: AgentJob) {
  // Use setImmediate to process asynchronously
  setImmediate(async () => {
    try {
      await processAgentJob(job);
    } catch (error) {
      console.error(`[Agent] Background processing failed for job ${job.id}:`, error);
    }
  });
}


