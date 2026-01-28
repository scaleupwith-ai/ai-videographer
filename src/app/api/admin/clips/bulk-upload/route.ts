import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import path from "path";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Video metadata from match-clips file
const VIDEO_METADATA: Record<string, {
  subject: string[];
  setting: string[];
  industry: string[];
  action: string[];
  mood: string[];
  camera: string[];
  style: string[];
  objects: string[];
  description: string;
  keywords: string;
}> = {
  "(19)": {
    subject: ["materials", "person", "tools", "tradesperson", "worker"],
    setting: ["indoor", "residential_site"],
    industry: ["construction", "renovation", "tiling"],
    action: ["installing", "working"],
    mood: ["professional"],
    camera: ["closeup", "slowmo"],
    style: ["documentary", "lifestyle"],
    objects: [],
    description: "A professional tiler uses specialized suction cups to precisely lower a large white porcelain tile onto a prepared adhesive bed. This slow-motion shot emphasizes the technical skill required for high-end residential floor installation.",
    keywords: "tiling, installation, tradesperson, construction, renovation, suction cups, flooring, home improvement, porcelain tile, adhesive, precision, manual labor",
  },
  "(22)": {
    subject: ["materials"],
    setting: ["commercial_building", "indoor"],
    industry: ["plumbing_trade", "renovation", "waterproofing"],
    action: [],
    mood: [],
    camera: [],
    style: ["documentary"],
    objects: [],
    description: "A steady stream of water leaks from a ceiling joint near a textured wall in a commercial setting. This shot highlights the immediate need for professional plumbing or waterproofing intervention.",
    keywords: "leak, water damage, waterproofing, plumbing, maintenance, ceiling, commercial building, dripping, moisture, repair, structural, inspection",
  },
  "(23)": {
    subject: ["materials"],
    setting: ["home", "indoor"],
    industry: ["plumbing_trade", "renovation"],
    action: [],
    mood: [],
    camera: [],
    style: ["documentary", "lifestyle"],
    objects: [],
    description: "Inside a home, a stainless steel pot sits on a wooden floor to catch water dripping from a ceiling leak. This scene illustrates a common domestic plumbing emergency and immediate damage control.",
    keywords: "water leak, plumbing, home repair, dripping, pot, damage, maintenance, indoor, household, moisture, emergency, renovation",
  },
  "(25)": {
    subject: ["product"],
    setting: ["home", "indoor"],
    industry: ["plumbing_trade"],
    action: [],
    mood: ["calm"],
    camera: ["closeup"],
    style: ["lifestyle", "minimalist"],
    objects: [],
    description: "A minimalist close-up of a modern chrome faucet with a single water droplet forming. The high-detail shot emphasizes themes of water conservation, waste, and the need for minor plumbing maintenance.",
    keywords: "faucet, tap, dripping, plumbing, water waste, conservation, chrome, bathroom, kitchen, repair, maintenance, home, minimal",
  },
  "(24)": {
    subject: ["materials"],
    setting: ["outdoor", "rooftop"],
    industry: ["construction", "electrical", "renovation"],
    action: [],
    mood: ["calm"],
    camera: ["wide"],
    style: ["documentary"],
    objects: [],
    description: "A wide-angle view of a modern building's exterior soffit against a clear blue sky, featuring installed security lighting and drainage piping, showcasing the final stages of residential construction.",
    keywords: "construction, architecture, soffit, exterior, lighting, plumbing, pipes, residential, blue sky, building, outdoor, modern design",
  },
  "(28)": {
    subject: ["person", "technology"],
    setting: ["home", "indoor"],
    industry: [],
    action: ["working"],
    mood: ["calm"],
    camera: ["closeup", "handheld"],
    style: ["cinematic"],
    objects: ["laptop"],
    description: "Warm morning light illuminates a person's hands as they open a laptop and begin typing. This cinematic shot captures the peaceful atmosphere of a productive remote work environment.",
    keywords: "typing, laptop, technology, productivity, sunlight, warm, remote work, office, focus, lifestyle, computing, morning",
  },
  "(21)": {
    subject: ["materials"],
    setting: ["outdoor"],
    industry: ["construction", "landscaping"],
    action: [],
    mood: ["calm"],
    camera: ["tracking", "handheld"],
    style: ["documentary", "minimalist"],
    objects: [],
    description: "A handheld tracking shot moves over wet concrete pavers in a suburban outdoor space. The footage captures the detailed texture and patterns of the ground after rainfall.",
    keywords: "paving, stones, wet, rain, outdoor, landscaping, texture, pattern, suburban, ground, concrete, grey",
  },
  "(26)": {
    subject: ["person"],
    setting: ["office", "indoor"],
    industry: [],
    action: ["working"],
    mood: ["dramatic"],
    camera: [],
    style: ["corporate", "lifestyle"],
    objects: ["laptop"],
    description: "A businessman in a grey suit sits at his office desk, appearing stressed and exhausted while working on his laptop. He rubs his face in frustration, highlighting corporate pressure.",
    keywords: "businessman, stress, office, work, fatigue, exhaustion, professional, corporate, laptop, pressure, headache, management",
  },
  "(20)": {
    subject: ["contractor", "person", "tools", "worker"],
    setting: ["home", "residential_site"],
    industry: ["carpentry", "construction", "renovation"],
    action: ["installing", "working"],
    mood: ["professional"],
    camera: ["wide"],
    style: ["documentary", "lifestyle"],
    objects: [],
    description: "A contractor in a safety helmet uses a ladder to install or adjust upper cabinets in a high-end kitchen renovation featuring wood and marble finishes.",
    keywords: "kitchen renovation, carpentry, contractor, hard hat, construction, home improvement, cabinets, installation, worker, residential, ladder",
  },
  "(27)": {
    subject: ["machinery", "worker"],
    setting: ["construction_site", "industrial"],
    industry: ["construction"],
    action: ["demolition", "working"],
    mood: ["dramatic"],
    camera: ["aerial", "wide"],
    style: ["cinematic", "documentary"],
    objects: [],
    description: "An aerial view of a yellow excavator moving earth at a large-scale construction site. The shot emphasizes the scale of heavy machinery used in industrial earthmoving or infrastructure operations.",
    keywords: "excavator, construction, machinery, heavy equipment, earthmoving, mining, quarry, industrial, aerial view, digger, infrastructure",
  },
  "(34)": {
    subject: ["materials", "product"],
    setting: ["office", "indoor"],
    industry: [],
    action: [],
    mood: [],
    camera: ["wide"],
    style: ["documentary"],
    objects: [],
    description: "A detailed static shot of many Australian fifty-dollar banknotes spread across a surface, symbolizing financial success, wealth, and commercial transactions.",
    keywords: "Australian dollars, money, finance, cash, currency, fifty dollars, wealth, economy, banknotes, business, investment, savings",
  },
  "(35)": {
    subject: ["materials", "product"],
    setting: ["office", "indoor"],
    industry: [],
    action: [],
    mood: ["energetic"],
    camera: ["slowmo"],
    style: [],
    objects: [],
    description: "Australian banknotes fall onto a surface in a dynamic, high-energy display of cash. This slow-motion footage represents financial abundance and the flow of currency.",
    keywords: "Australian dollars, money, cash, currency, wealth, falling money, finance, economy, business, investment, banknotes, vibrant",
  },
  "(30)": {
    subject: ["team"],
    setting: ["commercial_building", "indoor"],
    industry: [],
    action: ["working"],
    mood: ["professional", "energetic"],
    camera: ["closeup"],
    style: ["corporate", "documentary"],
    objects: [],
    description: "A group of business professionals in formal attire applaud enthusiastically during a conference or corporate event, celebrating success and professional achievement.",
    keywords: "clapping, applause, business conference, meeting, professionals, celebrating, team, success, audience, networking, corporate event",
  },
  "(37)": {
    subject: ["team", "person"],
    setting: ["indoor"],
    industry: [],
    action: ["talking"],
    mood: ["professional"],
    camera: ["handheld"],
    style: ["lifestyle", "documentary"],
    objects: ["phone"],
    description: "A group of colleagues gather around a table at a social event, laughing and looking at a smartphone together, showcasing team bonding and modern networking.",
    keywords: "networking, team, social event, smartphone, talking, coworkers, technology, connection, community, laughing, meeting, restaurant",
  },
  "(36)": {
    subject: ["team", "worker"],
    setting: ["office", "indoor"],
    industry: [],
    action: ["talking", "walking", "working"],
    mood: ["professional", "energetic"],
    camera: ["tracking", "wide"],
    style: ["corporate"],
    objects: ["laptop", "phone"],
    description: "A tracking shot through a busy, modern open-plan office where employees are actively working at desks, collaborating, and moving through the professional workspace.",
    keywords: "office, open plan, workers, business, productivity, corporate, modern workplace, team, working, professional environment, technology",
  },
  "(29)": {
    subject: ["person", "technology"],
    setting: ["indoor", "home"],
    industry: [],
    action: ["working"],
    mood: ["calm"],
    camera: ["closeup"],
    style: ["lifestyle", "minimalist"],
    objects: ["laptop"],
    description: "An extreme close-up focuses on a person's hands as they type efficiently on a laptop keyboard in a warm, minimalist environment.",
    keywords: "typing, keyboard, hands, laptop, tech, productivity, minimalist, closeup, working, focus, office, remote work",
  },
  "(33)": {
    subject: ["team"],
    setting: ["outdoor", "urban"],
    industry: [],
    action: ["walking"],
    mood: ["professional"],
    camera: ["wide"],
    style: ["cinematic", "lifestyle"],
    objects: [],
    description: "A group of stylish professionals disembark from a sleek white private jet. The shot exudes luxury and captures the lifestyle of high-end business travel and aviation.",
    keywords: "private jet, luxury travel, business travel, aviation, airplane, passengers, jet set, lifestyle, travel, professional, terminal",
  },
  "(32)": {
    subject: ["person"],
    setting: ["outdoor", "urban"],
    industry: [],
    action: ["walking"],
    mood: ["inspirational"],
    camera: ["wide", "tracking"],
    style: ["cinematic"],
    objects: [],
    description: "Two businessmen walk confidently away from a private jet on a runway during sunset, highlighting a moment of corporate success and premium travel.",
    keywords: "private jet, runway, sunset, luxury, business travel, aviation, success, travel, outdoors, corporate, partnership, lifestyle",
  },
  "(38)": {
    subject: ["team", "worker"],
    setting: ["office", "indoor"],
    industry: [],
    action: ["talking", "walking", "working"],
    mood: ["professional", "energetic"],
    camera: ["tracking"],
    style: ["corporate"],
    objects: ["laptop", "phone"],
    description: "A tracking shot captures the movement of professionals walking through a contemporary office hallway while engaging with colleagues and mobile devices.",
    keywords: "office, walking, workplace, professionals, corporate life, business, modern, communication, networking, movement, busy office",
  },
  "(31)": {
    subject: ["person"],
    setting: ["commercial_building", "indoor"],
    industry: [],
    action: ["working"],
    mood: ["professional"],
    camera: ["closeup"],
    style: ["documentary", "corporate"],
    objects: [],
    description: "A close-up of a professional in a suit clapping during a formal meeting, capturing a moment of recognition and corporate celebration.",
    keywords: "applause, clapping, business meeting, professional, suit, success, recognition, formal, corporate, celebration",
  },
  "(39)": {
    subject: ["team", "worker"],
    setting: ["office", "indoor"],
    industry: [],
    action: ["working"],
    mood: ["professional"],
    camera: ["aerial"],
    style: ["corporate", "minimalist"],
    objects: ["laptop"],
    description: "An overhead wide shot of a large, organized office space where numerous employees are focused on their computer screens, demonstrating collective productivity and corporate structure.",
    keywords: "overhead office, workplace, productivity, corporate, business, workers, desk, laptop, professional, organization, collaboration, open office",
  },
  "waterproofing": {
    subject: ["materials"],
    setting: ["outdoor"],
    industry: ["waterproofing", "construction"],
    action: [],
    mood: ["calm"],
    camera: ["closeup", "slowmo"],
    style: ["documentary", "minimalist"],
    objects: [],
    description: "A detailed close-up of water droplets bead and run off a dark, waterproof fabric surface. This shot effectively demonstrates the effectiveness of high-quality waterproofing materials.",
    keywords: "waterproofing, beads, water droplets, fabric, protection, surface tension, moisture, construction, material, durability, close-up, liquid",
  },
};

// Find metadata by matching filename
function findMetadata(filename: string) {
  // Try to match by number in parentheses
  const match = filename.match(/\((\d+)\)/);
  if (match) {
    const key = `(${match[1]})`;
    if (VIDEO_METADATA[key]) {
      return VIDEO_METADATA[key];
    }
  }
  
  // Check for waterproofing video (the one without a number)
  if (filename.toLowerCase().includes("waterproofing") && !filename.match(/\(\d+\)/)) {
    return VIDEO_METADATA["waterproofing"];
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    
    // Get the upload_clips directory
    const uploadDir = path.join(process.cwd(), "public", "upload_clips");
    
    // Check if directory exists
    try {
      await fs.access(uploadDir);
    } catch {
      return NextResponse.json({ error: "public/upload_clips directory not found" }, { status: 404 });
    }
    
    // Read all files
    const files = await fs.readdir(uploadDir);
    const videoFiles = files.filter(f => 
      f.endsWith(".mp4") || f.endsWith(".mov") || f.endsWith(".webm")
    );
    
    if (videoFiles.length === 0) {
      return NextResponse.json({ error: "No video files found in upload-clips" }, { status: 404 });
    }
    
    // Fetch all tags from database to map names to IDs
    const { data: allTags, error: tagsError } = await supabase
      .from("tags")
      .select("id, name, category");
    
    if (tagsError) {
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }
    
    // Create tag lookup map
    const tagMap = new Map<string, string>();
    allTags?.forEach(tag => {
      tagMap.set(`${tag.category}:${tag.name}`, tag.id);
    });
    
    const results: Array<{
      filename: string;
      status: "success" | "error" | "skipped";
      message: string;
      clipId?: string;
    }> = [];
    
    for (const filename of videoFiles) {
      const filePath = path.join(uploadDir, filename);
      const metadata = findMetadata(filename);
      
      if (!metadata) {
        results.push({
          filename,
          status: "skipped",
          message: "No metadata found for this video",
        });
        continue;
      }
      
      try {
        // Read file
        const fileBuffer = await fs.readFile(filePath);
        const fileSize = fileBuffer.length;
        
        // Generate unique key for R2
        const ext = path.extname(filename);
        const key = `clips/${uuid()}${ext}`;
        
        // Upload to R2
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: key,
          Body: fileBuffer,
          ContentType: "video/mp4",
        }));
        
        const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
        
        // Collect tag IDs
        const tagIds: string[] = [];
        const categories = ["subject", "setting", "industry", "action", "mood", "camera", "style", "objects"] as const;
        
        for (const category of categories) {
          const tagNames = metadata[category] || [];
          for (const tagName of tagNames) {
            const normalizedName = tagName.toLowerCase().replace(/ /g, "_");
            const tagId = tagMap.get(`${category}:${normalizedName}`);
            if (tagId) {
              tagIds.push(tagId);
            }
          }
        }
        
        // Create clip in database (duration will be 0, needs manual update or detection)
        const { data: clip, error: clipError } = await supabase
          .from("clips")
          .insert({
            clip_link: publicUrl,
            duration_seconds: 0, // Will need to be updated
            description: metadata.description,
            source_resolution: "4k",
          })
          .select()
          .single();
        
        if (clipError) {
          results.push({
            filename,
            status: "error",
            message: `DB error: ${clipError.message}`,
          });
          continue;
        }
        
        // Insert tags
        if (tagIds.length > 0) {
          const tagInserts = tagIds.map(tagId => ({
            clip_id: clip.id,
            tag_id: tagId,
          }));
          await supabase.from("clip_tags").insert(tagInserts);
        }
        
        // Insert keywords
        const keywords = metadata.keywords.split(",").map(k => k.trim()).filter(Boolean);
        if (keywords.length > 0) {
          const keywordInserts = keywords.map(keyword => ({
            clip_id: clip.id,
            keyword: keyword.toLowerCase(),
          }));
          await supabase.from("clip_keywords").insert(keywordInserts);
        }
        
        // Create 4K rendition entry
        await supabase.from("clip_renditions").insert({
          clip_id: clip.id,
          resolution: "4k",
          resolution_width: 3840,
          resolution_height: 2160,
          clip_url: publicUrl,
          file_size_bytes: fileSize,
          duration_seconds: 0,
        });
        
        results.push({
          filename,
          status: "success",
          message: `Uploaded with ${tagIds.length} tags and ${keywords.length} keywords`,
          clipId: clip.id,
        });
        
      } catch (error) {
        results.push({
          filename,
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    
    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;
    const skippedCount = results.filter(r => r.status === "skipped").length;
    
    return NextResponse.json({
      summary: {
        total: videoFiles.length,
        success: successCount,
        errors: errorCount,
        skipped: skippedCount,
      },
      results,
    });
    
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk upload failed" },
      { status: 500 }
    );
  }
}

