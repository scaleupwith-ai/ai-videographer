# AI Videographer Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │────▶│   Supabase      │────▶│   Cloudflare R2 │
│   (Next.js)     │     │   (Postgres+Auth)│     │   (Media Storage)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                │
        ▼                                                │
┌─────────────────┐     ┌─────────────────┐              │
│   Upstash Redis │◀────│   Fly.io Worker │◀─────────────┘
│   (Job Queue)   │     │   (FFmpeg)      │
└─────────────────┘     └─────────────────┘
```

## Prerequisites

1. **Supabase** account with a project
2. **Cloudflare** account with R2 storage enabled
3. **Vercel** account
4. **Fly.io** account
5. **Upstash** account (or self-hosted Redis)

---

## 1. Supabase Setup

### Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and keys from Settings > API

### Run Migrations
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

Or manually run the SQL from `supabase/migrations/0001_init.sql` in the SQL Editor.

### Enable Auth
1. Go to Authentication > Providers
2. Enable Email provider (disable email confirmation for dev)
3. Optionally enable OAuth providers

---

## 2. Cloudflare R2 Setup

### Create Bucket
1. Go to Cloudflare Dashboard > R2
2. Create a bucket named `ai-videographer`
3. Enable public access (or use presigned URLs)

### Create API Token
1. Go to R2 > Manage R2 API Tokens
2. Create a token with read/write permissions
3. Note the Access Key ID and Secret Access Key

### Configure CORS
Add this CORS policy to your bucket:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Get Endpoints
- **Endpoint**: `https://<account-id>.r2.cloudflarestorage.com`
- **Public URL**: `https://pub-<bucket-id>.r2.dev` (if public access enabled)

---

## 3. Upstash Redis Setup

1. Go to [upstash.com](https://upstash.com) and create a Redis database
2. Select a region close to your Fly.io worker region
3. Note the Redis URL (format: `redis://default:xxxxx@xxx.upstash.io:6379`)

---

## 4. Vercel Deployment (Web App)

### Deploy
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Environment Variables
Add these in Vercel Dashboard > Settings > Environment Variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Cloudflare R2
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=ai-videographer
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev

# Redis
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
```

---

## 5. Fly.io Deployment (Worker)

### Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### Create fly.toml
Create `worker/fly.toml`:

```toml
app = "ai-videographer-worker"
primary_region = "ord"  # Choose your region

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  FFMPEG_PATH = "/usr/bin/ffmpeg"
  FFPROBE_PATH = "/usr/bin/ffprobe"
  TEMP_DIR = "/tmp/renders"

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 2048
```

### Deploy Worker
```bash
cd worker

# Create app
fly apps create ai-videographer-worker

# Set secrets
fly secrets set \
  REDIS_URL="redis://default:xxx@xxx.upstash.io:6379" \
  NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..." \
  R2_ENDPOINT="https://xxx.r2.cloudflarestorage.com" \
  R2_ACCESS_KEY_ID="xxx" \
  R2_SECRET_ACCESS_KEY="xxx" \
  R2_BUCKET="ai-videographer" \
  R2_PUBLIC_BASE_URL="https://pub-xxx.r2.dev"

# Build and deploy
npm run build
fly deploy
```

### Scale Worker
```bash
# Scale to 1 machine (always running)
fly scale count 1

# Or use autoscaling for cost savings
fly autoscale set min=0 max=3
```

---

## 6. Local Development

### Start Services
```bash
# Start Redis and worker
docker-compose up -d

# Start Next.js dev server
npm run dev
```

### Environment Variables
Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Cloudflare R2
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=ai-videographer
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev

# Redis (local)
REDIS_URL=redis://localhost:6379
```

---

## Troubleshooting

### Worker Not Processing Jobs
1. Check Redis connection: `fly ssh console` then `redis-cli ping`
2. Check logs: `fly logs`
3. Ensure the worker is running: `fly status`

### Upload Failures
1. Check R2 CORS configuration
2. Verify R2 credentials are correct
3. Check browser console for errors

### Render Failures
1. Check worker logs for FFmpeg errors
2. Ensure assets are accessible from worker
3. Verify timeline JSON is valid

### Database Issues
1. Check Supabase logs
2. Verify RLS policies are correct
3. Ensure service role key has proper permissions

---

## Monitoring

### Vercel
- View function logs in Vercel Dashboard
- Monitor API routes performance

### Fly.io
- `fly logs` for real-time logs
- `fly status` for machine status
- Set up alerts in Fly.io Dashboard

### Upstash
- Monitor Redis metrics in Upstash Dashboard
- Set up alerts for queue depth

---

## Cost Optimization

1. **Fly.io Worker**: Use `fly autoscale` to scale to 0 when idle
2. **Vercel**: Use ISR for static content
3. **R2**: Set lifecycle rules to delete old renders
4. **Upstash**: Use the free tier for low volume

---

## Security Checklist

- [ ] Enable RLS on all Supabase tables
- [ ] Use environment variables for all secrets
- [ ] Enable CORS only for your domains
- [ ] Use presigned URLs for uploads (not public bucket)
- [ ] Rotate API keys periodically
- [ ] Enable Supabase auth email confirmation in production

