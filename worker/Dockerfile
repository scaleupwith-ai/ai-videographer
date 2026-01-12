# AI Videographer Render Worker
FROM node:20-bookworm-slim

# Install FFmpeg and dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Set environment variables
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Run the worker
CMD ["node", "dist/index.js"]

