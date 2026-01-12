# AI Videographer Deployment Guide

## Production Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │────▶│   Supabase      │────▶│   Cloudflare R2 │
│   (Next.js)     │     │   (Postgres)    │     │   (Media)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                │
        ▼                                                │
┌─────────────────┐     ┌─────────────────┐              │
│   Upstash Redis │◀────│   AWS EC2       │◀─────────────┘
│   (BullMQ)      │     │   (FFmpeg)      │
└─────────────────┘     └─────────────────┘
```

## Current Production Setup

| Component | Service | Status |
|-----------|---------|--------|
| Web App | Vercel | Ready to deploy |
| Database | Supabase Postgres | ✅ Running |
| Auth | Supabase Auth | ✅ Running |
| Media Storage | Cloudflare R2 | ✅ Configured |
| Job Queue | Upstash Redis | ✅ Running |
| Render Worker | AWS EC2 + Docker | ✅ Running |
| Container Registry | AWS ECR | ✅ Configured |

---

## 1. Supabase Setup

### Run Database Migration

Execute `supabase/migrations/0001_init.sql` in Supabase SQL Editor.

This creates:
- `projects` - Video projects with timeline JSON
- `media_assets` - Uploaded files metadata  
- `brand_presets` - Logo, colors, fonts, overlay styles
- `render_jobs` - Async render progress tracking

### Get Credentials

From Supabase Dashboard → Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Cloudflare R2 Setup

### Create Bucket
1. Cloudflare Dashboard → R2 → Create bucket: `ai-videographer`
2. Enable public access or use signed URLs

### Configure CORS
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### Get Credentials
- `R2_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`: From R2 API token
- `R2_SECRET_ACCESS_KEY`: From R2 API token
- `R2_BUCKET`: `ai-videographer`
- `R2_PUBLIC_BASE_URL`: `https://pub-xxx.r2.dev`

---

## 3. Upstash Redis Setup

1. Create database at [upstash.com](https://upstash.com)
2. Get connection URL: `rediss://default:xxx@xxx.upstash.io:6379`

---

## 4. AWS EC2 Worker Setup

### Current Configuration
- **Instance**: Amazon Linux on EC2
- **Runtime**: Docker with Node.js 20 + FFmpeg
- **Registry**: AWS ECR

### Build and Push Worker Image

```bash
cd worker

# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build for AMD64 (EC2)
docker buildx build --platform linux/amd64 \
  -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/ai-videographer-worker:latest \
  --push .
```

### Run on EC2

```bash
# Pull latest image
docker pull <account-id>.dkr.ecr.us-east-1.amazonaws.com/ai-videographer-worker:latest

# Run worker
docker run -d \
  --name render-worker \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_SUPABASE_URL="..." \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e REDIS_URL="rediss://..." \
  -e R2_ENDPOINT="..." \
  -e R2_ACCESS_KEY_ID="..." \
  -e R2_SECRET_ACCESS_KEY="..." \
  -e R2_BUCKET="ai-videographer" \
  -e R2_PUBLIC_BASE_URL="..." \
  -e FFMPEG_PATH=ffmpeg \
  -e FFPROBE_PATH=ffprobe \
  -e TEMP_DIR=/tmp/renders \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/ai-videographer-worker:latest
```

### Verify Worker

```bash
docker logs -f render-worker
# Should see: "Render worker started, waiting for jobs..."
```

---

## 5. Vercel Deployment (Web App)

### Deploy

```bash
npm install -g vercel
vercel
```

### Environment Variables

Add in Vercel Dashboard → Settings → Environment Variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cloudflare R2
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=ai-videographer
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev

# Redis
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
```

---

## 6. Local Development

### Environment Variables

Create `.env.local` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=ai-videographer
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev

REDIS_URL=redis://localhost:6379
```

### Start Development

```bash
# Start local Redis (optional, can use Upstash)
docker run -d -p 6379:6379 redis:7-alpine

# Start Next.js
npm run dev
```

---

## Troubleshooting

### Worker Not Processing Jobs
1. Check logs: `docker logs render-worker`
2. Verify Redis connection
3. Ensure Supabase credentials are correct

### Upload Failures
1. Check R2 CORS configuration
2. Verify bucket permissions
3. Check browser console for errors

### Render Failures
1. Check worker logs for FFmpeg errors
2. Ensure assets are accessible
3. Verify timeline JSON is valid

---

## Future Improvements

- [ ] GPU workers for faster rendering
- [ ] Auto-scaling with ECS/Fargate
- [ ] Job priority queues
- [ ] Render preview streaming
- [ ] Webhook notifications on completion
