FROM oven/bun:1.2.21-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY apps/socket-service/package.json ./apps/socket-service/
COPY packages ./packages

# Install dependencies
RUN bun install

# Copy source code
COPY apps/socket-service ./apps/socket-service
COPY turbo.json ./

# Expose WebSocket port
EXPOSE 8080

# Health check (WebSocket health endpoint)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start service
CMD ["bun", "run", "apps/socket-service/src/index.ts"]