# Corrected Docker Files

## 1. apps/gateway/Dockerfile
```dockerfile
FROM oven/bun:1.2.21-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb ./
COPY apps/gateway/package.json ./apps/gateway/
COPY packages ./packages

RUN bun install --frozen-lockfile

COPY apps/gateway ./apps/gateway
COPY turbo.json ./

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "apps/gateway/src/index.ts"]
```

## 2. apps/video-service/Dockerfile
```dockerfile
FROM oven/bun:1.2.21-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lockb ./
COPY apps/video-service/package.json ./apps/video-service/
COPY packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile

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
```

## 3. apps/transcript-worker/Dockerfile
```dockerfile
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
COPY package.json bun.lockb ./
COPY apps/transcript-worker/package.json ./apps/transcript-worker/
COPY packages ./packages

# Install Bun dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY apps/transcript-worker ./apps/transcript-worker
COPY turbo.json ./

# Set up Python virtual environment and install Whisper
RUN python3 -m venv /app/apps/transcript-worker/venv_py313 && \
    /app/apps/transcript-worker/venv_py313/bin/pip install --upgrade pip && \
    /app/apps/transcript-worker/venv_py313/bin/pip install openai-whisper

# Start worker
CMD ["bun", "run", "apps/transcript-worker/src/index.ts"]
```

## 4. docker-compose.yml
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: youtube-ai-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: haricharan1111
      POSTGRES_DB: finance-backend
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Message Queue
  redis:
    image: redis:7-alpine
    container_name: youtube-ai-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Gateway
  gateway:
    build:
      context: .
      dockerfile: apps/gateway/Dockerfile
    container_name: youtube-ai-gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - AUTH_SERVICE_URL=http://auth-service:3001
      - VIDEO_SERVICE_URL=http://video-service:3002
    depends_on:
      - auth-service
      - video-service
    restart: unless-stopped

  # Auth Service
  auth-service:
    build:
      context: .
      dockerfile: apps/auth-service/Dockerfile
    container_name: youtube-ai-auth
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:haricharan1111@postgres:5432/finance-backend
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  # Video Service
  video-service:
    build:
      context: .
      dockerfile: apps/video-service/Dockerfile
    container_name: youtube-ai-video
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:haricharan1111@postgres:5432/finance-backend
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - video_downloads:/app/apps/video-service/downloads
    restart: unless-stopped

  # Socket Service
  socket-service:
    build:
      context: .
      dockerfile: apps/socket-service/Dockerfile
    container_name: youtube-ai-socket
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  # Download Worker
  download-worker:
    build:
      context: .
      dockerfile: apps/download-worker/Dockerfile
    container_name: youtube-ai-download-worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:haricharan1111@postgres:5432/finance-backend
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - SOCKET_SERVICE_URL=http://socket-service:8080
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - video_downloads:/app/apps/download-worker/downloads
    restart: unless-stopped

  # Transcript Worker
  transcript-worker:
    build:
      context: .
      dockerfile: apps/transcript-worker/Dockerfile
    container_name: youtube-ai-transcript-worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:haricharan1111@postgres:5432/finance-backend
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - video_downloads:/app/apps/download-worker/downloads
    restart: unless-stopped

  # Summary Worker
  summary-worker:
    build:
      context: .
      dockerfile: apps/summary-worker/Dockerfile
    container_name: youtube-ai-summary-worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:haricharan1111@postgres:5432/finance-backend
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - GROQ_API_KEY=${GROQ_API_KEY}
      - SOCKET_SERVICE_URL=http://socket-service:8080
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

# Persistent volumes
volumes:
  postgres_data:
  redis_data:
  video_downloads:
```

## 5. .dockerignore
```
node_modules
dist
build
.git
.env
*.log
.DS_Store
apps/*/downloads
apps/*/node_modules
packages/*/node_modules
apps/transcript-worker/venv_py313
```

---

## Key Changes Made:

### Dockerfiles:
1. Fixed spacing in `rm -rf /var/lib/apt/lists/*`
2. Added curl installation to gateway
3. Fixed backslash placement in transcript-worker
4. Fixed spacing in CMD array

### docker-compose.yml:
1. Removed extra indentation from `services:`
2. Fixed DATABASE_URL (all on one line with correct password)
3. Fixed volume mount syntax (all on one line)
4. Fixed volumes section indentation

### .dockerignore:
1. Removed extra indentation from `dist`
