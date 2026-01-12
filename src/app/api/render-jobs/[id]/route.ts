import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get render job with project ownership check
    const { data: job, error: fetchError } = await supabase
      .from("render_jobs")
      .select(`
        *,
        projects!inner(owner_id)
      `)
      .eq("id", id)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: "Render job not found" }, { status: 404 });
    }

    // Check ownership
    if ((job.projects as { owner_id: string }).owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Remove projects from response
    const { projects, ...jobData } = job;

    return NextResponse.json({ job: jobData });
  } catch (error) {
    console.error("Error fetching render job:", error);
    return NextResponse.json(
      { error: "Failed to fetch render job" },
      { status: 500 }
    );
  }
}

