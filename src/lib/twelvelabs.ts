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
 * Updated for TwelveLabs API v1.3 which uses 'models' instead of 'engines'
 */
export async function createIndex(
  name: string,
  models: Array<{
    name: string;
    options?: string[];
  }> = [
    { name: "marengo2.7", options: ["visual", "audio"] },
  ]
): Promise<TwelveLabsIndex> {
  const response = await twelveLabsFetch("/indexes", {
    method: "POST",
    body: JSON.stringify({
      index_name: name,
      models,
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
 */
export async function createIndexingTaskFromUrl(
  videoUrl: string,
  indexId: string,
  options: {
    language?: string;
    disableVideoStream?: boolean;
  } = {}
): Promise<CreateTaskResponse> {
  const response = await twelveLabsFetch("/tasks", {
    method: "POST",
    body: JSON.stringify({
      index_id: indexId,
      url: videoUrl,
      language: options.language || "en",
      disable_video_stream: options.disableVideoStream || false,
    }),
  });

  const data = await safeParseJson(response);

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
 * Generate content from an indexed video
 */
export async function generateFromVideo(
  options: GenerateOptions
): Promise<GenerateResponse> {
  const { videoId, type, prompt } = options;
  
  const body: Record<string, unknown> = {
    video_id: videoId,
    type,
  };
  
  if (prompt) {
    body.prompt = prompt;
  }

  const response = await twelveLabsFetch("/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = await safeParseJson(response);

  if (!response.ok) {
    throw new Error(`Failed to generate content: ${JSON.stringify(data)}`);
  }

  return data as GenerateResponse;
}

/**
 * Generate a summary of an indexed video
 */
export async function generateSummary(videoId: string): Promise<string> {
  const response = await generateFromVideo({
    videoId,
    type: "summary",
    prompt: "Provide a comprehensive summary of this video including main subjects, actions, setting, and mood.",
  });
  return response.data || "";
}

/**
 * Generate chapters for an indexed video
 */
export async function generateChapters(
  videoId: string
): Promise<GenerateResponse["chapters"]> {
  const response = await generateFromVideo({
    videoId,
    type: "chapter",
  });
  return response.chapters || [];
}

/**
 * Generate highlights for an indexed video
 */
export async function generateHighlights(
  videoId: string
): Promise<GenerateResponse["highlights"]> {
  const response = await generateFromVideo({
    videoId,
    type: "highlight",
  });
  return response.highlights || [];
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
 * Get video details
 */
export async function getVideoDetails(videoId: string, indexId?: string): Promise<VideoDetails> {
  // If we have an indexId, use the proper endpoint
  const endpoint = indexId 
    ? `/indexes/${indexId}/videos/${videoId}`
    : `/videos/${videoId}`;
  
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
  indexId?: string
): Promise<VideoAnalysisResult> {
  // Fetch all analysis types in parallel
  const [summary, chapters, highlights, details] = await Promise.all([
    generateSummary(videoId).catch((e) => {
      console.error("Failed to generate summary:", e);
      return "";
    }),
    generateChapters(videoId).catch((e) => {
      console.error("Failed to generate chapters:", e);
      return [];
    }),
    generateHighlights(videoId).catch((e) => {
      console.error("Failed to generate highlights:", e);
      return [];
    }),
    getVideoDetails(videoId, indexId).catch((e) => {
      console.error("Failed to get video details:", e);
      return null;
    }),
  ]);

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

