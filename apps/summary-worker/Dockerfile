FROM oven/bun:1.2.21-slim

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY apps/summary-worker/package.json ./apps/summary-worker/
COPY packages ./packages

# Install dependencies
RUN bun install

# Copy source code
COPY apps/summary-worker ./apps/summary-worker
COPY turbo.json ./

# Start worker
CMD ["bun", "run", "apps/summary-worker/src/index.ts"]