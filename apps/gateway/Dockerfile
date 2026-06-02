FROM oven/bun:1.2.21-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock ./
COPY apps/gateway/package.json ./apps/gateway/
COPY packages ./packages

# Install dependencies
RUN bun install

# Copy source code
COPY apps/gateway ./apps/gateway
COPY turbo.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start service
CMD ["bun", "run", "apps/gateway/src/index.ts"]