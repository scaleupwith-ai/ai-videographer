/**
 * Autonomous AI Agent Types
 * 
 * The agent system processes video creation jobs autonomously.
 * Jobs are queued, processed in order, and the user can close the browser.
 */

export type AgentJobStatus = 
  | 'queued'           // Job is waiting to be processed
  | 'analyzing'        // AI is analyzing inputs/description
  | 'scripting'        // AI is writing the script
  | 'voiceover'        // Generating voiceover audio
  | 'selecting_clips'  // AI is selecting video clips
  | 'selecting_audio'  // AI is selecting music/SFX
  | 'building_timeline'// AI is constructing the timeline
  | 'rendering'        // Video is being rendered
  | 'completed'        // Job finished successfully
  | 'failed';          // Job failed with error

export type AgentJobType = 'voiceover_video' | 'talking_head' | 'template';

export interface AgentJob {
  id: string;
  userId: string;
  type: AgentJobType;
  status: AgentJobStatus;
  progress: number; // 0-100
  
  // Input data
  input: AgentJobInput;
  
  // Processing state (updated as job progresses)
  state: AgentJobState;
  
  // Output
  output?: AgentJobOutput;
  
  // Error info if failed
  error?: {
    message: string;
    step: AgentJobStatus;
    timestamp: string;
  };
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Notification preferences
  notifyOnComplete: boolean;
  notifyEmail?: string;
}

export interface AgentJobInput {
  // Common fields
  title?: string;
  description: string;
  resolution: { width: number; height: number };
  
  // For voiceover videos
  voiceId?: string;
  script?: string; // If user provides their own script
  musicId?: string;
  musicVolume?: number;
  
  // For talking head
  talkingHeadAssetId?: string;
  brollFrequency?: string;
  brollLength?: number;
  enableCaptions?: boolean;
  
  // Template
  templateId?: string;
  templateVariables?: Record<string, string>;
  
  // Caption settings
  captionSettings?: {
    enabled: boolean;
    wordsPerBlock: number;
    font: string;
  };
  
  // Selected assets (user's own assets to include)
  selectedAssetIds?: string[];
}

export interface AgentJobState {
  // Generated content (persisted as job progresses)
  generatedScript?: string;
  voiceoverAssetId?: string;
  voiceoverDuration?: number;
  timedCaptions?: string;
  captionSegments?: Array<{ start: number; end: number; text: string }>;
  
  // AI decisions
  selectedClips?: Array<{ clipId: string; startTime: number; duration: number }>;
  selectedMusic?: { id: string; title: string; volume: number };
  selectedSfx?: Array<{ id: string; atTime: number; volume: number }>;
  selectedOverlays?: Array<{ id: string; atTime: number; duration: number }>;
  
  // Final timeline
  projectId?: string;
  timelineJson?: object;
  
  // Render info
  renderJobId?: string;
  awsBatchJobId?: string;
}

export interface AgentJobOutput {
  projectId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  sizeBytes: number;
}

// Step definitions for the agent
export interface AgentStep {
  status: AgentJobStatus;
  name: string;
  description: string;
  progressStart: number; // Progress percentage when step starts
  progressEnd: number;   // Progress percentage when step ends
  required: boolean;     // Whether this step is always executed
}

// The steps in order for voiceover videos
export const VOICEOVER_STEPS: AgentStep[] = [
  { status: 'analyzing', name: 'Analyzing', description: 'Understanding your request', progressStart: 0, progressEnd: 5, required: true },
  { status: 'scripting', name: 'Writing Script', description: 'AI is writing your script', progressStart: 5, progressEnd: 15, required: true },
  { status: 'voiceover', name: 'Generating Voice', description: 'Creating voiceover audio', progressStart: 15, progressEnd: 30, required: true },
  { status: 'selecting_clips', name: 'Selecting Clips', description: 'AI is choosing video clips', progressStart: 30, progressEnd: 45, required: true },
  { status: 'selecting_audio', name: 'Selecting Audio', description: 'Choosing music and effects', progressStart: 45, progressEnd: 55, required: true },
  { status: 'building_timeline', name: 'Building Timeline', description: 'Constructing your video', progressStart: 55, progressEnd: 65, required: true },
  { status: 'rendering', name: 'Rendering', description: 'Creating final video', progressStart: 65, progressEnd: 95, required: true },
  { status: 'completed', name: 'Complete', description: 'Your video is ready!', progressStart: 95, progressEnd: 100, required: true },
];

// The steps for talking head videos (no script/voiceover generation)
export const TALKING_HEAD_STEPS: AgentStep[] = [
  { status: 'analyzing', name: 'Analyzing', description: 'Understanding your video', progressStart: 0, progressEnd: 10, required: true },
  { status: 'selecting_clips', name: 'Selecting B-roll', description: 'AI is choosing overlay clips', progressStart: 10, progressEnd: 35, required: true },
  { status: 'selecting_audio', name: 'Selecting Audio', description: 'Choosing background music', progressStart: 35, progressEnd: 45, required: true },
  { status: 'building_timeline', name: 'Building Timeline', description: 'Constructing your video', progressStart: 45, progressEnd: 55, required: true },
  { status: 'rendering', name: 'Rendering', description: 'Creating final video', progressStart: 55, progressEnd: 95, required: true },
  { status: 'completed', name: 'Complete', description: 'Your video is ready!', progressStart: 95, progressEnd: 100, required: true },
];

// Get steps for a job type
export function getStepsForJobType(type: AgentJobType): AgentStep[] {
  switch (type) {
    case 'talking_head':
      return TALKING_HEAD_STEPS;
    case 'voiceover_video':
    default:
      return VOICEOVER_STEPS;
  }
}

// Calculate progress for a step
export function calculateProgress(step: AgentStep, stepProgress: number = 0): number {
  const range = step.progressEnd - step.progressStart;
  return Math.round(step.progressStart + (range * stepProgress / 100));
}


