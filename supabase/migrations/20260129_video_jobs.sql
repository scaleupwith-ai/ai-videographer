-- Video Jobs table for TwelveLabs async processing
CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_url TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  duration NUMERIC,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  provider_task_id TEXT,
  result_json JSONB,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs(user_id);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);

-- Index for provider task ID lookups
CREATE INDEX IF NOT EXISTS idx_video_jobs_provider_task_id ON video_jobs(provider_task_id) WHERE provider_task_id IS NOT NULL;

-- Enable RLS
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own jobs
CREATE POLICY "Users can read own video jobs"
  ON video_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own jobs
CREATE POLICY "Users can create own video jobs"
  ON video_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can update any job (for worker)
CREATE POLICY "Service role can update video jobs"
  ON video_jobs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_video_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_jobs_updated_at
  BEFORE UPDATE ON video_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_video_jobs_updated_at();


