/**
 * Autonomous Agent Processor
 * 
 * This module contains the core logic for processing agent jobs.
 * Each step is executed in sequence, with state persisted to the database.
 * If a step fails, the job can be retried from that step.
 */

import { createClient } from "@supabase/supabase-js";
import {
  AgentJob,
  AgentJobStatus,
  getStepsForJobType,
  calculateProgress,
} from "./types";

// Create admin Supabase client for background processing
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Update job status and progress in database
 */
async function updateJobStatus(
  jobId: string, 
  status: AgentJobStatus, 
  progress: number,
  updates: Partial<AgentJob> = {}
) {
  const supabase = getAdminSupabase();
  
  const { error } = await supabase
    .from("agent_jobs")
    .update({
      status,
      progress,
      state: updates.state,
      output: updates.output,
      error: updates.error,
      started_at: status !== 'queued' ? new Date().toISOString() : undefined,
      completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : undefined,
    })
    .eq("id", jobId);
    
  if (error) {
    console.error(`[Agent] Failed to update job ${jobId}:`, error);
  }
}

/**
 * Step 1: Analyze the request
 * Understands user intent and prepares for processing
 */
async function stepAnalyze(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Analyzing job ${job.id}`);
  
  // For now, analysis is just validation and setup
  // Future: Could use AI to extract industry, mood, key themes
  
  const updates = {
    ...job,
    state: {
      ...job.state,
    }
  };
  
  // Small delay to show progress
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return updates;
}

/**
 * Step 2: Generate script (for voiceover videos)
 */
async function stepGenerateScript(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Generating script for job ${job.id}`);
  
  // If user provided a script, use it
  if (job.input.script) {
    return {
      ...job,
      state: {
        ...job.state,
        generatedScript: job.input.script,
      }
    };
  }
  
  // Call script generation API
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/generate-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: job.input.description,
      selectedAssets: job.input.selectedAssetIds,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Script generation failed: ${error}`);
  }
  
  const data = await response.json();
  
  return {
    ...job,
    state: {
      ...job.state,
      generatedScript: data.script,
    }
  };
}

/**
 * Step 3: Generate voiceover
 */
async function stepGenerateVoiceover(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Generating voiceover for job ${job.id}`);
  
  const script = job.state.generatedScript;
  if (!script) {
    throw new Error("No script available for voiceover");
  }
  
  // Get default voice if not specified
  let voiceId = job.input.voiceId;
  if (!voiceId) {
    const supabase = getAdminSupabase();
    const { data: voices } = await supabase
      .from("voices")
      .select("id")
      .eq("is_default", true)
      .limit(1);
    
    if (voices && voices.length > 0) {
      voiceId = voices[0].id;
    } else {
      const { data: anyVoice } = await supabase
        .from("voices")
        .select("id")
        .limit(1);
      voiceId = anyVoice?.[0]?.id;
    }
  }
  
  if (!voiceId) {
    throw new Error("No voice available for voiceover");
  }
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/generate-voiceover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script,
      voiceId,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voiceover generation failed: ${error}`);
  }
  
  const data = await response.json();
  
  return {
    ...job,
    state: {
      ...job.state,
      voiceoverAssetId: data.assetId,
      voiceoverDuration: data.durationSec,
      timedCaptions: data.formattedCaptions,
      captionSegments: data.captions,
    }
  };
}

/**
 * Step 4: Select clips using AI
 */
async function stepSelectClips(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Selecting clips for job ${job.id}`);
  
  // Clips are selected during timeline building
  // This step is a placeholder for future direct clip selection
  
  return job;
}

/**
 * Step 5: Select audio (music/SFX)
 */
async function stepSelectAudio(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Selecting audio for job ${job.id}`);
  
  // Audio is selected during timeline building
  // This step is a placeholder for future direct audio selection
  
  return job;
}

/**
 * Step 6: Build timeline
 */
async function stepBuildTimeline(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Building timeline for job ${job.id}`);
  
  const body: Record<string, unknown> = {
    title: job.input.title || job.input.description.slice(0, 50),
    description: job.input.description,
    resolution: job.input.resolution,
    captionSettings: job.input.captionSettings,
  };
  
  if (job.type === 'talking_head') {
    // Talking head mode
    body.talkingHeadMode = true;
    body.talkingHeadAssetId = job.input.talkingHeadAssetId;
    body.brollFrequency = job.input.brollFrequency;
    body.brollLength = job.input.brollLength;
    body.enableCaptions = job.input.enableCaptions;
    body.selectedMusicId = job.input.musicId;
    body.musicVolume = job.input.musicVolume;
  } else {
    // Voiceover mode
    body.script = job.state.generatedScript;
    body.voiceoverAssetId = job.state.voiceoverAssetId;
    body.voiceoverDurationSec = job.state.voiceoverDuration;
    body.timedCaptions = job.state.timedCaptions;
    body.captionSegments = job.input.captionSettings?.enabled ? job.state.captionSegments : undefined;
    body.selectedMusicId = job.input.musicId;
    body.musicVolume = job.input.musicVolume;
    body.aiMode = true; // Let AI make decisions
  }
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/build-timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Timeline building failed: ${error}`);
  }
  
  const data = await response.json();
  
  return {
    ...job,
    state: {
      ...job.state,
      projectId: data.projectId,
      timelineJson: data.timeline,
    }
  };
}

/**
 * Step 7: Render video
 */
async function stepRender(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Starting render for job ${job.id}`);
  
  const projectId = job.state.projectId;
  if (!projectId) {
    throw new Error("No project ID for rendering");
  }
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Render submission failed: ${error}`);
  }
  
  const data = await response.json();
  
  return {
    ...job,
    state: {
      ...job.state,
      renderJobId: data.renderJobId,
      awsBatchJobId: data.batchJobId,
    }
  };
}

/**
 * Wait for render to complete
 */
async function waitForRender(job: AgentJob): Promise<AgentJob> {
  console.log(`[Agent] Waiting for render to complete for job ${job.id}`);
  
  const renderJobId = job.state.renderJobId;
  if (!renderJobId) {
    throw new Error("No render job ID");
  }
  
  const maxWaitTime = 30 * 60 * 1000; // 30 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/render-jobs/${renderJobId}`);
    
    if (!response.ok) {
      throw new Error("Failed to check render status");
    }
    
    const data = await response.json();
    
    if (data.status === 'completed') {
      // Render completed - fetch project to get output
      const projectResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${job.state.projectId}`);
      const projectData = await projectResponse.json();
      
      return {
        ...job,
        output: {
          projectId: job.state.projectId!,
          videoUrl: projectData.rendered_url || data.output_url,
          thumbnailUrl: projectData.thumbnail_url,
          duration: projectData.duration_sec || 0,
          sizeBytes: 0,
        }
      };
    } else if (data.status === 'failed') {
      throw new Error(`Render failed: ${data.error || 'Unknown error'}`);
    }
    
    // Update progress based on render progress
    const steps = getStepsForJobType(job.type);
    const renderStep = steps.find(s => s.status === 'rendering');
    if (renderStep && data.progress) {
      const progress = calculateProgress(renderStep, data.progress);
      await updateJobStatus(job.id, 'rendering', progress, { state: job.state });
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error("Render timed out after 30 minutes");
}

/**
 * Send completion notification
 */
async function sendCompletionNotification(job: AgentJob) {
  if (!job.notifyOnComplete || !job.notifyEmail) return;
  
  console.log(`[Agent] Sending completion notification to ${job.notifyEmail}`);
  
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: job.notifyEmail,
        subject: `Your video "${job.input.title || 'Untitled'}" is ready!`,
        body: `Good news! Your AI-generated video is complete and ready to view.\n\nView your video: ${process.env.NEXT_PUBLIC_APP_URL}/app/projects/${job.output?.projectId}`,
      }),
    });
  } catch (error) {
    console.error("[Agent] Failed to send notification:", error);
  }
}

/**
 * Main processor function - executes a job through all steps
 */
export async function processAgentJob(job: AgentJob): Promise<void> {
  console.log(`[Agent] Starting job ${job.id} (type: ${job.type})`);
  
  const steps = getStepsForJobType(job.type);
  let currentJob = job;
  
  try {
    for (const step of steps) {
      // Skip completed step
      if (step.status === 'completed') continue;
      
      // Update status
      const progress = step.progressStart;
      await updateJobStatus(currentJob.id, step.status, progress, { state: currentJob.state });
      
      // Execute step
      switch (step.status) {
        case 'analyzing':
          currentJob = await stepAnalyze(currentJob);
          break;
        case 'scripting':
          if (currentJob.type === 'voiceover_video') {
            currentJob = await stepGenerateScript(currentJob);
          }
          break;
        case 'voiceover':
          if (currentJob.type === 'voiceover_video') {
            currentJob = await stepGenerateVoiceover(currentJob);
          }
          break;
        case 'selecting_clips':
          currentJob = await stepSelectClips(currentJob);
          break;
        case 'selecting_audio':
          currentJob = await stepSelectAudio(currentJob);
          break;
        case 'building_timeline':
          currentJob = await stepBuildTimeline(currentJob);
          break;
        case 'rendering':
          currentJob = await stepRender(currentJob);
          currentJob = await waitForRender(currentJob);
          break;
      }
      
      // Update progress to end of step
      await updateJobStatus(currentJob.id, step.status, step.progressEnd, { state: currentJob.state });
    }
    
    // Job completed successfully
    await updateJobStatus(currentJob.id, 'completed', 100, { 
      state: currentJob.state,
      output: currentJob.output,
    });
    
    // Send notification
    await sendCompletionNotification(currentJob);
    
    console.log(`[Agent] Job ${job.id} completed successfully`);
    
  } catch (error) {
    console.error(`[Agent] Job ${job.id} failed:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await updateJobStatus(currentJob.id, 'failed', currentJob.progress, {
      state: currentJob.state,
      error: {
        message: errorMessage,
        step: currentJob.status,
        timestamp: new Date().toISOString(),
      }
    });
  }
}


