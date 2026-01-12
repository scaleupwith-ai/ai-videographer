# AI Videographer

Create professional videos with AI-powered editing and real b-roll footage. This is a scene-based video editor MVP that uses FFmpeg for server-side rendering.

## Features

- **Scene-Based Editor**: Drag-and-drop scenes, not a complex timeline
- **AI Director (Stub)**: Automatically structures videos based on your script and assets
- **Real B-Roll**: Uses your uploaded footage, no AI-generated visuals
- **Multiple Formats**: Landscape (16:9), Vertical (9:16), Square (1:1)
- **Text Overlays**: Boxed, lower-third, and minimal styles
- **Audio Mixing**: Background music with voiceover ducking
- **Logo Overlay**: Position your brand logo anywhere
- **Async Rendering**: FFmpeg renders videos in the background

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **State**: Zustand for editor state
- **Drag & Drop**: dnd-kit
- **Forms**: React Hook Form + Zod
- **Auth/Database**: Supabase (Postgres + Auth + RLS)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Queue**: BullMQ + Redis
- **Rendering**: FFmpeg (Node worker)

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, signup)
│   │   ├── (dashboard)/       # Protected app pages
│   │   │   └── app/
│   │   │       ├── page.tsx           # Dashboard
│   │   │       ├── new/               # New video wizard
│   │   │       ├── library/           # Media library
│   │   │       ├── projects/[id]/     # Project viewer
│   │   │       │   └── edit/          # Scene editor
│   │   │       └── settings/          # Settings
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # App shell
│   │   ├── dashboard/        # Dashboard components
│   │   ├── project/          # Project viewer
│   │   ├── editor/           # Scene editor
│   │   └── library/          # Media library
│   └── lib/
│       ├── supabase/         # Supabase clients
│       ├── r2/               # R2 storage client
│       ├── timeline/         # Timeline JSON v1 schema
│       ├── queue/            # BullMQ queue
│       └── state/            # Zustand stores
├── supabase/
│   ├── migrations/           # SQL migrations
│   └── seed.sql              # Demo data
├── worker/                   # FFmpeg render worker
│   └── src/
│       ├── index.ts          # Worker entry
│       ├── render/           # Render orchestration
│       └── db.ts             # Database client
├── docker-compose.yml        # Local dev services
└── DEPLOYMENT.md             # Deployment guide
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local Redis and worker)
- Supabase account
- Cloudflare R2 bucket

### 1. Install Dependencies

```bash
npm install
cd worker && npm install && cd ..
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### 3. Set Up Database

Run the Supabase migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually run supabase/migrations/0001_init.sql in SQL Editor
```

### 4. Start Development

```bash
# Start Redis and worker
docker-compose up -d

# Start Next.js
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Timeline JSON Spec (v1)

The timeline JSON is the single source of truth for each video project:

```typescript
{
  version: 1,
  project: {
    id: string,
    title: string,
    type: string,
    aspectRatio: "landscape" | "vertical" | "square",
    resolution: { width: number, height: number },
    fps: number
  },
  scenes: [{
    id: string,
    assetId: string | null,
    kind: "video" | "image",
    inSec: number,
    outSec: number,
    durationSec: number,
    cropMode: "cover" | "contain" | "fill",
    overlays: {
      title: string | null,
      subtitle: string | null,
      position: "center" | "top" | "bottom" | "lower_third" | "upper_third",
      stylePreset: "boxed" | "lower_third" | "minimal"
    },
    transitionOut: "crossfade" | "fade_black" | null
  }],
  global: {
    music: { assetId: string | null, volume: number },
    voiceover: { assetId: string | null, volume: number },
    captions: { enabled: boolean, burnIn: boolean },
    brand: {
      logoAssetId: string | null,
      logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right",
      logoSize: number,
      colors: { primary, secondary, accent, text }
    },
    export: { codec, bitrateMbps, crf, audioKbps }
  },
  rendering: {
    output: { url, thumbnailUrl, durationSec, sizeBytes }
  }
}
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/assets/upload-url` | Get presigned upload URL |
| POST | `/api/assets/complete` | Save asset metadata |
| DELETE | `/api/assets/[id]` | Delete asset |
| GET/POST | `/api/projects` | List/create projects |
| GET/PATCH/DELETE | `/api/projects/[id]` | Get/update/delete project |
| POST | `/api/projects/[id]/duplicate` | Duplicate project |
| POST | `/api/projects/[id]/generate-plan` | Generate timeline (AI stub) |
| POST | `/api/projects/[id]/render` | Start render job |
| GET | `/api/render-jobs/[id]` | Get render job status |

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.

### Quick Deploy

1. **Database**: Run migrations on Supabase
2. **Web App**: Deploy to Vercel
3. **Worker**: Deploy to Fly.io
4. **Queue**: Create Upstash Redis

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
