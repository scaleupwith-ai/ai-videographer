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
 * POST /api/templates/[templateId]/use
 * Create a new project from a template
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

    const { variables, title } = await request.json() as {
      variables: Record<string, string>;
      title?: string;
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
    
    // Generate a new project ID
    const projectId = uuid();
    processedTimeline.project.id = projectId;
    processedTimeline.project.title = title || processedTimeline.project.title;

    // Create the project
    const { error: projectError } = await adminSupabase
      .from("projects")
      .insert({
        id: projectId,
        owner_id: user.id,
        title: title || template.title,
        type: template.category,
        status: "draft",
        aspect_ratio: processedTimeline.project.aspectRatio || "landscape",
        resolution_w: processedTimeline.project.resolution?.width || 1920,
        resolution_h: processedTimeline.project.resolution?.height || 1080,
        timeline_json: processedTimeline,
      });

    if (projectError) {
      console.error("Project creation error:", projectError);
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    // Increment template use count
    await adminSupabase
      .from("templates")
      .update({ use_count: (template.use_count || 0) + 1 })
      .eq("id", templateId);

    return NextResponse.json({
      projectId,
      message: "Project created from template",
    });

  } catch (error) {
    console.error("Template use error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to use template" },
      { status: 500 }
    );
  }
}

