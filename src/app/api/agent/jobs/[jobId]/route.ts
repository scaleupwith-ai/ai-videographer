import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/agent/jobs/[jobId] - Get job status and details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { data: job, error } = await supabase
      .from("agent_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();
      
    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    
    return NextResponse.json({ job });
    
  } catch (error) {
    console.error("[Agent] Error fetching job:", error);
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent/jobs/[jobId] - Cancel a queued job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Can only cancel queued jobs
    const { data: job, error: fetchError } = await supabase
      .from("agent_jobs")
      .select("status")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();
      
    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    
    if (job.status !== 'queued') {
      return NextResponse.json({ 
        error: "Can only cancel queued jobs. This job is already processing." 
      }, { status: 400 });
    }
    
    const { error: deleteError } = await supabase
      .from("agent_jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", user.id);
      
    if (deleteError) {
      throw deleteError;
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("[Agent] Error cancelling job:", error);
    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}

