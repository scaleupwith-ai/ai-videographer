import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Replace template variables in a string
function replaceVariables(str: string, variables: Record<string, string>): string {
  let result = str;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

// Recursively replace variables in an object
function replaceVariablesInObject(obj: any, variables: Record<string, string>): any {
  if (typeof obj === "string") {
    return replaceVariables(obj, variables);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceVariablesInObject(item, variables));
  }
  if (typeof obj === "object" && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceVariablesInObject(value, variables);
    }
    return result;
  }
  return obj;
}

/**
 * POST /api/templates/[templateId]/preview
 * Create a temporary project and render it for preview
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { variables } = await request.json() as {
      variables: Record<string, string>;
    };

    // Fetch the template
    const { data: template, error: templateError } = await adminSupabase
      .from("templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Replace variables in the timeline template
    const timelineTemplate = template.timeline_template;
    const processedTimeline = replaceVariablesInObject(timelineTemplate, variables);
    
    // Generate a preview project ID
    const projectId = uuid();
    processedTimeline.project.id = projectId;
    processedTimeline.project.title = `Preview: ${template.title}`;

    // Create a temporary project for rendering
    const { error: projectError } = await adminSupabase
      .from("projects")
      .insert({
        id: projectId,
        owner_id: user.id,
        title: `Preview: ${template.title}`,
        type: "preview",
        status: "draft",
        aspect_ratio: processedTimeline.project.aspectRatio || "landscape",
        resolution_w: processedTimeline.project.resolution?.width || 1920,
        resolution_h: processedTimeline.project.resolution?.height || 1080,
        timeline_json: processedTimeline,
      });

    if (projectError) {
      console.error("Preview project creation error:", projectError);
      return NextResponse.json({ error: "Failed to create preview project" }, { status: 500 });
    }

    // Trigger render
    const renderUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/projects/${projectId}/render`;
    const renderRes = await fetch(renderUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!renderRes.ok) {
      const error = await renderRes.text();
      console.error("Render trigger error:", error);
      return NextResponse.json({ error: "Failed to start render" }, { status: 500 });
    }

    const renderData = await renderRes.json();
    const renderJobId = renderData.renderJobId;

    // Poll for render completion (max 2 minutes)
    const maxWaitTime = 2 * 60 * 1000;
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const { data: renderJob } = await adminSupabase
        .from("render_jobs")
        .select("status, output_url, error")
        .eq("id", renderJobId)
        .single();

      if (renderJob?.status === "completed" && renderJob?.output_url) {
        return NextResponse.json({
          previewUrl: renderJob.output_url,
          projectId,
        });
      }

      if (renderJob?.status === "failed") {
        return NextResponse.json({ 
          error: renderJob.error || "Render failed" 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Render timed out" }, { status: 408 });

  } catch (error) {
    console.error("Template preview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview template" },
      { status: 500 }
    );
  }
}

