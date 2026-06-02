FROM oven/bun:1.2.21-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY apps/video-service/package.json ./apps/video-service/
COPY packages ./packages

# Install dependencies
RUN bun install

# Copy source code
COPY apps/video-service ./apps/video-service
COPY turbo.json ./

# Create downloads directory
RUN mkdir -p /app/apps/video-service/downloads

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start service
CMD ["bun", "run", "apps/video-service/src/index.ts"]