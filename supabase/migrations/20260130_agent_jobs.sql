-- Agent Jobs table for autonomous video generation
-- Jobs are processed in the background and users can close browser

CREATE TABLE IF NOT EXISTS agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job type and status
  type TEXT NOT NULL CHECK (type IN ('voiceover_video', 'talking_head', 'template')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'analyzing', 'scripting', 'voiceover', 
    'selecting_clips', 'selecting_audio', 'building_timeline', 
    'rendering', 'completed', 'failed'
  )),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Input data (user's request)
  input JSONB NOT NULL DEFAULT '{}',
  
  -- Processing state (updated as job progresses)
  state JSONB NOT NULL DEFAULT '{}',
  
  -- Output (populated when job completes)
  output JSONB,
  
  -- Error info if failed
  error JSONB,
  
  -- Notification preferences
  notify_on_complete BOOLEAN NOT NULL DEFAULT false,
  notify_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_id ON agent_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs(status);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_created_at ON agent_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_status ON agent_jobs(user_id, status);

-- RLS Policies
ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own agent jobs"
  ON agent_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create own agent jobs"
  ON agent_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own queued jobs (cancel)
CREATE POLICY "Users can cancel own queued jobs"
  ON agent_jobs FOR DELETE
  USING (auth.uid() = user_id AND status = 'queued');

-- Service role can update any job (for background processing)
CREATE POLICY "Service role can update jobs"
  ON agent_jobs FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON agent_jobs TO authenticated;
GRANT ALL ON agent_jobs TO service_role;

