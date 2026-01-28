import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Describes a video using Gemini's vision capabilities
 * Returns a structured description with name, description, and tags
 */
export async function describeVideo(videoUrl: string): Promise<{
  name: string;
  description: string;
  tags: string[];
}> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Analyze this video and provide:
1. A short, descriptive name (max 50 characters)
2. A detailed description of what's shown in the video (2-3 sentences)
3. Relevant tags for categorization (5-10 tags)

Respond in JSON format:
{
  "name": "Short descriptive name",
  "description": "Detailed description of the video content",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  try {
    // For video analysis, we need to use the file API or pass video bytes
    // For now, we'll use a text prompt approach if direct video isn't supported
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "video/mp4",
          data: await fetchVideoAsBase64(videoUrl),
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Could not parse Gemini response");
  } catch (error) {
    console.error("Gemini video description error:", error);
    throw error;
  }
}

/**
 * Describes an image using Gemini's vision capabilities
 */
export async function describeImage(imageUrl: string): Promise<{
  name: string;
  description: string;
  tags: string[];
}> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Analyze this image and provide:
1. A short, descriptive name (max 50 characters)
2. A detailed description of what's shown (2-3 sentences)
3. Relevant tags for categorization (5-10 tags)

Respond in JSON format:
{
  "name": "Short descriptive name",
  "description": "Detailed description of the image content",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  try {
    const imageData = await fetchImageAsBase64(imageUrl);
    const mimeType = imageUrl.includes(".png") ? "image/png" : 
                     imageUrl.includes(".gif") ? "image/gif" : 
                     imageUrl.includes(".webp") ? "image/webp" : "image/jpeg";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageData,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Could not parse Gemini response");
  } catch (error) {
    console.error("Gemini image description error:", error);
    throw error;
  }
}

/**
 * Helper to fetch video as base64
 */
async function fetchVideoAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

/**
 * Helper to fetch image as base64
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}







