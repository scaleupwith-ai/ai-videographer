import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/templates/[id]/preview
 * Renders a quick preview of a template with the given variables
 * This is for testing/previewing only - doesn't save to DB
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Get variables from request
    const { variables } = await request.json() as { 
      variables: Record<string, string>;
    };

    // Build the timeline from template with variables substituted
    const timelineTemplate = template.timeline_template as any;
    
    // Simple variable substitution in the timeline JSON
    let timelineStr = JSON.stringify(timelineTemplate);
    
    // Replace all {{variable}} placeholders with actual values
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      timelineStr = timelineStr.replace(placeholder, value || "");
    }
    
    // Parse back to JSON
    const timeline = JSON.parse(timelineStr);
    
    // For a quick preview, we'll render using the worker
    // Create a temporary render job that doesn't save to projects
    const workerUrl = process.env.RENDER_WORKER_URL || "http://localhost:3001";
    
    console.log(`Rendering template preview for template ${id}`);
    
    // Call worker directly for preview
    const renderResponse = await fetch(`${workerUrl}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeline,
        isPreview: true, // Flag to indicate this is a preview, don't save
      }),
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error("Worker preview error:", errorText);
      return NextResponse.json(
        { error: "Failed to render preview. Worker may not support previews yet." },
        { status: 500 }
      );
    }

    const { previewUrl } = await renderResponse.json();

    return NextResponse.json({
      previewUrl,
      message: "Preview rendered successfully",
    });
  } catch (error) {
    console.error("Template preview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to render preview" },
      { status: 500 }
    );
  }
}







