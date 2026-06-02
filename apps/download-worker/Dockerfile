FROM oven/bun:1.2.21-slim

WORKDIR /app

# Install yt-dlp and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && pip3 install --break-system-packages yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY apps/download-worker/package.json ./apps/download-worker/
COPY packages ./packages

# Install dependencies
RUN bun install

# Copy source code
COPY apps/download-worker ./apps/download-worker
COPY turbo.json ./

# Create downloads directory
RUN mkdir -p /app/apps/download-worker/downloads

# Start worker
CMD ["bun", "run", "apps/download-worker/src/index.ts"]