FROM oven/bun:1.2.21-slim

WORKDIR /app

# Install Python, pip, and ffmpeg for Whisper
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY apps/transcript-worker/package.json ./apps/transcript-worker/
COPY packages ./packages

# Install Bun dependencies
RUN bun install

# Copy source code
COPY apps/transcript-worker ./apps/transcript-worker
COPY turbo.json ./

# Set up Python virtual environment and install Whisper
RUN python3 -m venv /app/apps/transcript-worker/venv_py313 && \
    /app/apps/transcript-worker/venv_py313/bin/pip install --upgrade pip && \
    /app/apps/transcript-worker/venv_py313/bin/pip install openai-whisper

# Start worker
CMD ["bun", "run", "apps/transcript-worker/src/index.ts"]