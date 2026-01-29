/**
 * TwelveLabs Video Understanding API Client
 *
 * Used for video indexing and analysis (replacing Gemini for video processing)
 */

const TWELVELABS_API_BASE = "https://api.twelvelabs.io/v1.3";

interface TwelveLabsConfig {
  apiKey: string;
  indexId?: string;
}

function getConfig(): TwelveLabsConfig {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) {
    throw new Error("TWELVELABS_API_KEY environment variable is not set");
  }
  return {
    apiKey,
    indexId: process.env.TWELVELABS_INDEX_ID,
  };
}

async function twelveLabsFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response & { endpoint: string }> {
  const { apiKey } = getConfig();
  const url = `${TWELVELABS_API_BASE}${endpoint}`;
  
  console.log(`TwelveLabs API Request: ${options.method || "GET"} ${url}`);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  // Attach endpoint to response for better error messages
  return Object.assign(response, { endpoint });
}

/**
 * Safely parse JSON from a response, handling HTML error pages
 */
async function safeParseJson(response: Response & { endpoint?: string }): Promise<unknown> {
  const text = await response.text();
  const endpoint = response.endpoint || "unknown";
  
  // Check if the response is HTML (error page)
  if (text.trim().startsWith("<") || text.trim().startsWith("<!")) {
    throw new Error(
      `TwelveLabs API returned an HTML error page for endpoint "${endpoint}". ` +
      `Status: ${response.status} ${response.statusText}. ` +
      `This usually means the endpoint doesn't exist or the API version is wrong.`
    );
  }
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Failed to parse TwelveLabs response as JSON for endpoint "${endpoint}". ` +
      `Status: ${response.status}. Response: ${text.substring(0, 200)}`
    );
  }
}

// ============================================================================
// INDEX MANAGEMENT
// ============================================================================

export interface TwelveLabsIndex {
  _id: string;
  index_name: string;
  engines: Array<{
    engine_name: string;
    engine_options: string[];
  }>;
  video_count: number;
  created_at: string;
}

/**
 * Create a new index for video storage
 * Updated for TwelveLabs API v1.3 which uses 'model_name' parameter
 */
export async function createIndex(
  name: string,
  modelName: string = "marengo2.7"
): Promise<TwelveLabsIndex> {
  const response = await twelveLabsFetch("/indexes", {
    method: "POST",
    body: JSON.stringify({
      index_name: name,
      model_name: modelName,
    }),
  });

  const data = await safeParseJson(response);

  if (!response.ok) {
    throw new Error(`Failed to create index: ${JSON.stringify(data)}`);
  }

  return data as TwelveLabsIndex;
}

/**
 * List all indexes
 */
export async function listIndexes(): Promise<TwelveLabsIndex[]> {
  const response = await twelveLabsFetch("/indexes");
  const data = await safeParseJson(response) as { data?: TwelveLabsIndex[] };
  
  if (!response.ok) {
    throw new Error(`Failed to list indexes: ${JSON.stringify(data)}`);
  }

  return data.data || [];
}

/**
 * Get or create a default index for the application
 */
export async function getOrCreateDefaultIndex(): Promise<string> {
  const { indexId } = getConfig();
  
  // If index ID is configured, use it
  if (indexId) {
    return indexId;
  }
  
  // Otherwise, look for or create a default index
  const indexes = await listIndexes();
  const defaultIndex = indexes.find((i) => i.index_name === "ai-videographer");
  
  if (defaultIndex) {
    return defaultIndex._id;
  }
  
  // Create new index
  const newIndex = await createIndex("ai-videographer");
  return newIndex._id;
}

// ============================================================================
// VIDEO INDEXING TASKS
// ============================================================================

export interface IndexingTask {
  _id: string;
  index_id: string;
  video_id?: string;
  status: "pending" | "indexing" | "ready" | "failed";
  process?: {
    percentage: number;
    remain_seconds?: number;
  };
  metadata?: {
    filename?: string;
    duration?: number;
    width?: number;
    height?: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateTaskResponse {
  _id: string;
  status: string;
}

/**
 * Create a video indexing task from a URL
 * The video will be downloaded and processed by TwelveLabs
 * Note: TwelveLabs requires multipart/form-data for this endpoint
 */
export async function createIndexingTaskFromUrl(
  videoUrl: string,
  indexId: string
): Promise<CreateTaskResponse> {
  const { apiKey } = getConfig();
  
  // TwelveLabs requires multipart/form-data for task creation
  // Parameter must be "video_url" (not "url")
  const formData = new FormData();
  formData.append("index_id", indexId);
  formData.append("video_url", videoUrl);
  
  const url = `${TWELVELABS_API_BASE}/tasks`;
  console.log(`TwelveLabs API Request: POST ${url}`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      // Don't set Content-Type - fetch will set it with the correct boundary for FormData
    },
    body: formData,
  });

  const data = await safeParseJson(Object.assign(response, { endpoint: "/tasks" }));

  if (!response.ok) {
    throw new Error(`Failed to create indexing task: ${JSON.stringify(data)}`);
  }

  return data as CreateTaskResponse;
}

/**
 * Get the status of an indexing task
 */
export async function getTaskStatus(taskId: string): Promise<IndexingTask> {
  const response = await twelveLabsFetch(`/tasks/${taskId}`);
  const data = await safeParseJson(response);

  if (!response.ok) {
    throw new Error(`Failed to get task status: ${JSON.stringify(data)}`);
  }

  return data as IndexingTask;
}

/**
 * Wait for a task to complete (with polling)
 * Returns the final task status
 */
export async function waitForTaskCompletion(
  taskId: string,
  options: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onProgress?: (task: IndexingTask) => void;
  } = {}
): Promise<IndexingTask> {
  const { pollIntervalMs = 5000, timeoutMs = 600000, onProgress } = options;
  const startTime = Date.now();

  while (true) {
    const task = await getTaskStatus(taskId);
    
    if (onProgress) {
      onProgress(task);
    }

    if (task.status === "ready") {
      return task;
    }

    if (task.status === "failed") {
      throw new Error(`Indexing task failed: ${taskId}`);
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Indexing task timed out after ${timeoutMs}ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

// ============================================================================
// VIDEO ANALYSIS (Generate from indexed video)
// ============================================================================

export interface GenerateOptions {
  videoId: string;
  type: "summary" | "chapter" | "highlight" | "text";
  prompt?: string;
}

export interface GenerateResponse {
  id: string;
  data?: string;
  chapters?: Array<{
    chapter_number: number;
    start: number;
    end: number;
    chapter_title: string;
    chapter_summary: string;
  }>;
  highlights?: Array<{
    start: number;
    end: number;
    highlight: string;
    highlight_summary: string;
  }>;
}

/**
 * Analyze content from an indexed video using the /analyze endpoint
 * TwelveLabs API v1.3 uses POST /analyze with streaming response
 */
export async function analyzeVideo(
  videoId: string,
  prompt: string
): Promise<string> {
  const { apiKey } = getConfig();
  
  const body = {
    video_id: videoId,
    prompt,
  };

  const url = `${TWELVELABS_API_BASE}/analyze`;
  console.log(`TwelveLabs API Request: POST ${url}`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to analyze video: ${response.status} - ${text.substring(0, 500)}`);
  }

  // Handle streaming response - collect all chunks
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body from analyze endpoint");
  }

  let result = "";
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    // Parse SSE events if present
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data:")) {
        try {
          const data = JSON.parse(line.slice(5).trim());
          if (data.text) {
            result += data.text;
          }
        } catch {
          // Raw text, not JSON
          result += line.slice(5).trim();
        }
      } else if (line.trim() && !line.startsWith("event:")) {
        // Direct text response
        try {
          const data = JSON.parse(line);
          if (data.data) {
            result += data.data;
          }
        } catch {
          result += line;
        }
      }
    }
  }

  return result.trim();
}

/**
 * Generate a summary of an indexed video using the /analyze endpoint
 */
export async function generateSummary(videoId: string): Promise<string> {
  return analyzeVideo(
    videoId,
    "Provide a comprehensive summary of this video. Include the main subjects, their actions, the setting, atmosphere, and any important visual or audio elements. Be descriptive but concise."
  );
}

/**
 * Generate chapters for an indexed video using the /analyze endpoint
 * Returns structured chapter data parsed from the AI response
 */
export async function generateChapters(
  videoId: string
): Promise<GenerateResponse["chapters"]> {
  const response = await analyzeVideo(
    videoId,
    `Analyze this video and break it down into distinct chapters. For each chapter, provide:
1. A chapter number
2. The start time in seconds
3. The end time in seconds  
4. A short title
5. A one-sentence summary

Format your response as a JSON array with objects containing: chapter_number, start, end, chapter_title, chapter_summary.
Only respond with the JSON array, no other text.`
  );
  
  try {
    // Try to parse JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse chapters JSON:", e);
  }
  
  return [];
}

/**
 * Generate highlights for an indexed video using the /analyze endpoint
 * Returns structured highlight data parsed from the AI response
 */
export async function generateHighlights(
  videoId: string
): Promise<GenerateResponse["highlights"]> {
  const response = await analyzeVideo(
    videoId,
    `Identify the most interesting or important moments in this video. For each highlight, provide:
1. The start time in seconds
2. The end time in seconds
3. A short title for the highlight
4. A one-sentence summary of what happens

Format your response as a JSON array with objects containing: start, end, highlight, highlight_summary.
Only respond with the JSON array, no other text.`
  );
  
  try {
    // Try to parse JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse highlights JSON:", e);
  }
  
  return [];
}

// ============================================================================
// VIDEO SEARCH
// ============================================================================

export interface SearchOptions {
  indexId: string;
  query: string;
  searchOptions?: ("visual" | "conversation" | "text_in_video" | "logo")[];
  threshold?: "low" | "medium" | "high";
  pageLimit?: number;
}

export interface SearchResult {
  id: string;
  clips: Array<{
    video_id: string;
    score: number;
    start: number;
    end: number;
    metadata?: Record<string, unknown>;
    thumbnail_url?: string;
  }>;
  page_info: {
    page: number;
    limit_per_page: number;
    total_results: number;
  };
}

/**
 * Search indexed videos
 */
export async function searchVideos(
  options: SearchOptions
): Promise<SearchResult> {
  const { indexId, query, searchOptions = ["visual", "conversation"], threshold = "medium", pageLimit = 10 } = options;

  const response = await twelveLabsFetch("/search", {
    method: "POST",
    body: JSON.stringify({
      index_id: indexId,
      query,
      search_options: searchOptions,
      threshold,
      page_limit: pageLimit,
    }),
  });

  const data = await safeParseJson(response);

  if (!response.ok) {
    throw new Error(`Search failed: ${JSON.stringify(data)}`);
  }

  return data as SearchResult;
}

// ============================================================================
// VIDEO DETAILS
// ============================================================================

export interface VideoDetails {
  _id: string;
  index_id: string;
  metadata: {
    filename: string;
    duration: number;
    fps: number;
    width: number;
    height: number;
    size: number;
  };
  hls?: {
    video_url: string;
    thumbnail_urls: string[];
  };
  created_at: string;
  updated_at: string;
}

/**
 * Get video details - requires indexId in API v1.3
 */
export async function getVideoDetails(videoId: string, indexId: string): Promise<VideoDetails> {
  const endpoint = `/indexes/${indexId}/videos/${videoId}`;
  
  const response = await twelveLabsFetch(endpoint);
  const data = await safeParseJson(response);

  if (!response.ok) {
    throw new Error(`Failed to get video details: ${JSON.stringify(data)}`);
  }

  return data as VideoDetails;
}

// ============================================================================
// COMPREHENSIVE ANALYSIS (Combines multiple outputs)
// ============================================================================

export interface VideoAnalysisResult {
  videoId: string;
  summary: string;
  chapters: GenerateResponse["chapters"];
  highlights: GenerateResponse["highlights"];
  metadata: VideoDetails["metadata"];
  thumbnails: string[];
}

/**
 * Perform comprehensive analysis on an indexed video
 * This combines summary, chapters, highlights, and metadata
 */
export async function analyzeIndexedVideo(
  videoId: string,
  indexId: string
): Promise<VideoAnalysisResult> {
  console.log(`[TwelveLabs] Starting comprehensive analysis for video ${videoId} in index ${indexId}`);
  
  // Generate summary first - this is the most important
  let summary = "";
  try {
    console.log(`[TwelveLabs] Generating summary...`);
    summary = await generateSummary(videoId);
    console.log(`[TwelveLabs] Summary generated: ${summary.substring(0, 100)}...`);
  } catch (e) {
    console.error("Failed to generate summary:", e);
  }

  // Then get chapters and highlights in parallel
  const [chapters, highlights] = await Promise.all([
    generateChapters(videoId).catch((e) => {
      console.error("Failed to generate chapters:", e);
      return [];
    }),
    generateHighlights(videoId).catch((e) => {
      console.error("Failed to generate highlights:", e);
      return [];
    }),
  ]);

  // Get video details for metadata
  let details: VideoDetails | null = null;
  try {
    details = await getVideoDetails(videoId, indexId);
  } catch (e) {
    console.error("Failed to get video details:", e);
  }

  console.log(`[TwelveLabs] Analysis complete. Summary: ${summary.length > 0 ? 'yes' : 'no'}, Chapters: ${chapters?.length || 0}, Highlights: ${highlights?.length || 0}`);

  return {
    videoId,
    summary,
    chapters,
    highlights,
    metadata: details?.metadata || {
      filename: "",
      duration: 0,
      fps: 0,
      width: 0,
      height: 0,
      size: 0,
    },
    thumbnails: details?.hls?.thumbnail_urls || [],
  };
}

// ============================================================================
// FULL PROCESSING PIPELINE
// ============================================================================

export interface ProcessVideoResult {
  taskId: string;
  videoId: string;
  analysis: VideoAnalysisResult;
}

/**
 * Complete video processing pipeline:
 * 1. Create indexing task from URL
 * 2. Wait for indexing to complete
 * 3. Perform comprehensive analysis
 *
 * Use this for the worker/process endpoint
 */
export async function processVideoFromUrl(
  videoUrl: string,
  options: {
    indexId?: string;
    onProgress?: (progress: number, status: string) => void;
  } = {}
): Promise<ProcessVideoResult> {
  const { onProgress } = options;
  
  // Get or create index
  const indexId = options.indexId || (await getOrCreateDefaultIndex());
  
  onProgress?.(5, "Creating indexing task...");
  
  // Create indexing task
  const task = await createIndexingTaskFromUrl(videoUrl, indexId);
  const taskId = task._id;
  
  onProgress?.(10, "Video uploaded to TwelveLabs, indexing started...");
  
  // Wait for indexing to complete with progress updates
  const completedTask = await waitForTaskCompletion(taskId, {
    onProgress: (t) => {
      const percentage = t.process?.percentage || 0;
      // Map 0-100 indexing progress to 10-70 overall progress
      const mappedProgress = 10 + Math.round(percentage * 0.6);
      onProgress?.(mappedProgress, `Indexing: ${percentage}%`);
    },
  });

  const videoId = completedTask.video_id;
  if (!videoId) {
    throw new Error("Indexing completed but no video ID returned");
  }

  onProgress?.(75, "Indexing complete, generating analysis...");
  
  // Perform comprehensive analysis
  const analysis = await analyzeIndexedVideo(videoId, indexId);
  
  onProgress?.(100, "Analysis complete");

  return {
    taskId,
    videoId,
    analysis,
  };
}

