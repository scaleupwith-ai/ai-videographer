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

// Apply variable substitutions to timeline
function applyVariables(timeline: any, variables: Record<string, any>): any {
  const json = JSON.stringify(timeline);
  
  // Replace all {{variable}} placeholders
  let result = json;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, String(value));
  }
  
  return JSON.parse(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const supabase = await createClient();
    const adminSupabase = getAdminSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { variables, title } = await request.json() as {
      variables: Record<string, any>;
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

    // Apply variables to the timeline template
    const timeline = applyVariables(template.timeline_template, variables || {});
    
    // Generate a new project ID
    const projectId = uuid();
    timeline.project.id = projectId;
    timeline.project.title = title || template.title;

    // Create the project
    const { data: project, error: projectError } = await adminSupabase
      .from("projects")
      .insert({
        id: projectId,
        owner_id: user.id,
        title: title || template.title,
        type: "template",
        timeline_json: timeline,
        status: "draft",
        duration_sec: template.duration_sec,
        description: `Created from template: ${template.title}`,
      })
      .select()
      .single();

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
      projectId: project.id,
      timeline,
    });
  } catch (error) {
    console.error("Template use error:", error);
    return NextResponse.json(
      { error: "Failed to use template" },
      { status: 500 }
    );
  }
}







