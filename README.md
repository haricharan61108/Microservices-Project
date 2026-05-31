# YouTube AI Platform - Video Transcription & Summarization System

A scalable microservices-based platform for processing YouTube videos with AI-powered transcription and summarization capabilities. Built with a focus on learning distributed systems, message queues, and real-time updates.

## Project Progress: 15% Complete

### System Architecture

```
Frontend
   |
   v
API Gateway (Port 3000)
   |
   +--------------------+
   |                    |
   v                    v
Auth Service       Video Service
(Port 3001)
                        |
                        v
                 Queue (Redis / RabbitMQ)
                        |
                        v
                Transcription Worker
                        |
                        v
                 AI Summary Worker
                        |
                        v
                  PostgreSQL

Meanwhile:
Workers emit status events
        |
        v
WebSocket Gateway
        |
        v
Frontend gets live updates
```

## What's Been Built So Far

### ✅ Infrastructure Setup
- **Monorepo Architecture**: Turborepo-based monorepo with Bun runtime
- **API Gateway**: Express-based gateway for routing requests to microservices
- **Auth Service**: User authentication service with database integration
- **Database Layer**: Prisma 7 with PostgreSQL adapter pattern
- **Type Safety**: Shared TypeScript types across all services

### Project Structure

```
youtube-ai-platform/
├── apps/
│   ├── auth-service/          # Authentication microservice (Port 3001)
│   │   └── src/
│   │       └── index.ts       # Login & Register endpoints
│   └── gateway/               # API Gateway (Port 3000)
│       └── src/
│           └── index.ts       # Routes requests to microservices
│
├── packages/
│   ├── database/              # Shared database package
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # User model
│   │   │   └── migrations/    # Database migrations
│   │   └── index.ts           # Prisma client with PG adapter
│   │
│   ├── shared-types/          # TypeScript type definitions
│   │   └── src/
│   │       └── index.ts       # LoginRequest, LoginResponse
│   │
│   └── [eslint-config, typescript-config, ui]
│
└── turbo.json                 # Monorepo build configuration
```

## Tech Stack

### Core Technologies
- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Monorepo**: [Turborepo](https://turbo.build/) - High-performance build system
- **Language**: TypeScript - Type-safe development
- **API Framework**: Express.js - REST API server
- **Database**: PostgreSQL - Relational database
- **ORM**: Prisma 7 - Modern database toolkit with adapter pattern

### Libraries & Tools
- **@prisma/adapter-pg** - PostgreSQL adapter for Prisma 7
- **pg** - PostgreSQL client for Node.js
- **axios** - HTTP client for service communication
- **cors** - Cross-origin resource sharing

## Key Features Implemented

### 1. API Gateway (Port 3000)
- Central entry point for all client requests
- Routes authentication requests to auth service
- Error handling and service communication

### 2. Auth Service (Port 3001)
- User registration with database persistence
- Login endpoint with JWT-ready structure
- Prisma integration for database operations

### 3. Database Infrastructure
- User model with email/password authentication
- Prisma 7 migration system
- Connection pooling with pg adapter pattern

## Setup Instructions

### Prerequisites
- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- PostgreSQL database running
- Node.js (for compatibility)

### Installation

1. **Clone and install dependencies**
```bash
cd youtube-ai-platform
bun install
```

2. **Set up database**
```bash
cd packages/database

# Create .env file
echo 'DATABASE_URL="postgresql://user:password@localhost:5432/youtube_ai"' > .env

# Run migrations
bunx prisma migrate dev --name init

# Generate Prisma Client
bunx prisma generate
```

3. **Create .env for auth-service**
```bash
cd apps/auth-service
cp ../../packages/database/.env .env
```

### Running Services

**Run all services with Turbo:**
```bash
bun run dev
```

**Run individual services:**
```bash
# Gateway
cd apps/gateway && bun run dev

# Auth Service
cd apps/auth-service && bun run dev
```

### Testing Endpoints

**Health Check:**
```bash
curl http://localhost:3000/
```

**Register User:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## Key Learnings & Technical Insights

### 1. Prisma 7 Migration
**Challenge**: Prisma 7 removed the `url` property from schema.prisma
**Solution**:
- Move database URL to `prisma.config.ts` for migrations
- Use adapter pattern with `PrismaPg` at runtime
- Pass connection via `new PrismaClient({ adapter })`

**Code Pattern:**
```typescript
import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

### 2. Monorepo Workspace Dependencies
**Learning**: Workspace packages need proper configuration
- Use `workspace:*` for internal dependencies
- Export prisma client from database package
- Services import only from `@repo/database`, not direct Prisma packages

### 3. Runtime Compatibility
**Issue**: tsx (Node.js) had runtime errors with Prisma 7 generated code
**Solution**: Use Bun's native TypeScript support
- Changed from `tsx watch` to `bun --watch`
- Bun handles Prisma 7's TypeScript generation correctly

### 4. Service Communication Pattern
**Pattern**: Gateway → Service communication via HTTP
```typescript
// Gateway proxies to auth service
const response = await axios.post<LoginResponse>(
  "http://localhost:3001/login",
  body
);
```

### 5. Type Safety Across Services
**Pattern**: Shared types package ensures consistency
```typescript
// packages/shared-types
export interface LoginRequest {
  email: string;
  password: string;
}

// Used in both gateway and auth-service
import { LoginRequest } from "@repo/shared-types";
```

### 6. Database Migration Workflow
**Commands**:
- `bunx prisma migrate dev` - Create and apply migrations
- `bunx prisma migrate reset` - Reset database (requires consent for AI safety)
- `bunx prisma generate` - Generate Prisma Client
- `bunx prisma studio` - Visual database editor

## What's Next (Remaining 85%)

### Phase 2: Video Service
- Video upload endpoint
- YouTube URL processing
- Video metadata extraction
- Queue integration

### Phase 3: Message Queue
- Redis or RabbitMQ setup
- Job queue for video processing
- Task distribution to workers

### Phase 4: Transcription Worker
- Speech-to-text integration (Whisper API / AssemblyAI)
- Process videos from queue
- Store transcripts in database

### Phase 5: AI Summary Worker
- Google Gemini API integration
- Generate summaries from transcripts
- Save results to database

### Phase 6: WebSocket Gateway
- Real-time status updates
- Worker event streaming
- Frontend notifications

### Phase 7: Frontend
- React/Next.js interface
- Video upload UI
- Real-time progress tracking
- Display transcripts & summaries

## Development Commands

```bash
# Install dependencies
bun install

# Run all services in development
bun run dev

# Build all packages
bun run build

# Run specific service
bun run dev --filter=auth-service

# Database commands
cd packages/database
bunx prisma migrate dev    # Create migration
bunx prisma studio         # Open database GUI
bunx prisma generate       # Regenerate client
```

## Project Goals & Learning Objectives

1. **Microservices Architecture**: Building loosely coupled services
2. **Message Queues**: Asynchronous job processing at scale
3. **Real-time Communication**: WebSocket implementation
4. **Type Safety**: End-to-end TypeScript across services
5. **Database Design**: Prisma ORM with PostgreSQL
6. **API Gateway Pattern**: Centralized routing and authentication
7. **Worker Pattern**: Background job processing
8. **Monorepo Management**: Turborepo for efficient builds

## License

MIT

## Author

Built as a learning project to understand distributed systems and microservices architecture.



 Looking at your existing architecture, I can see you've
  built a well-structured system with workers, queues, and
   WebSocket updates. Here's a clear breakdown of steps to
   add AI summarization:

  Architecture Overview

  You'll follow the same pattern as transcript generation:
  - Transcript Worker completes → adds job to
  Summarization Queue → Summarization Worker processes →
  updates database → notifies via WebSocket

  Steps to Implement AI Summarization

  1. Database Schema Updates

  Add summary fields to your Video model:
  - summary (TEXT, nullable)
  - summaryStatus (ENUM: 'pending', 'processing',
  'completed', 'failed')
  - summaryError (TEXT, nullable)
  Create a new Prisma migration for these fields.

  2. Create Summarization Worker 
  (apps/summarization-worker/)

  Follow the same structure as transcript-worker:
  - Package structure: package.json, src/index.ts
  - Dependencies: @repo/database, @repo/queue,
  @repo/socket-events, AI SDK (OpenAI/Anthropic)
  - Functionality:
    - Listen to summarizationQueue
    - Fetch transcript from database
    - Call LLM API to generate summary
    - Update database with summary
    - Emit WebSocket event for completion

  3. Update Queue Package (packages/queue/)

  Add new queue definition:
  summarizationQueue: Queue<{ videoId: number }>

  4. Update Socket Events (packages/socket-events/)

  Add new event types:
  - SUMMARIZATION_STARTED
  - SUMMARIZATION_COMPLETED
  - SUMMARIZATION_FAILED

  5. Modify Transcript Worker

  After successful transcription:
  - Add job to summarizationQueue with videoId
  - Similar to how download-worker adds to transcriptQueue

  6. Update Video Service API

  Add endpoint or extend existing ones to:
  - Return summary and summaryStatus in video responses
  - Handle status checks for summarization progress

  7. Environment Variables

  Add API keys:
  GEMINI_API_KEY=your_key

  8. Update Turbo Configuration

  Add summarization-worker to:
  - Root turbo.json pipeline
  - Root package.json workspace

## AI Summarization Setup (COMPLETED ✅)

The platform now uses **Groq AI** for fast, free video summarization instead of Google Gemini.

### Why Groq?

We switched from Google Gemini to Groq because:
- **No billing required** - Completely free with generous limits
- **No Google Cloud setup** - Simple email signup
- **Faster inference** - Groq's LPU infrastructure is optimized for speed
- **Better free tier** - 14,400 requests/day (vs Gemini's 1,500)
- **No quota issues** - Works immediately after signup

### Getting Your Groq API Key

1. **Sign up at Groq Console**: https://console.groq.com
2. **No credit card needed** - Just email verification
3. **Create API Key**:
   - Click "API Keys" in the sidebar
   - Click "Create API Key"
   - Copy the key (starts with `gsk_...`)

### Configuration Steps

1. **Add API key to root `.env` file**:
```bash
# In /youtube-ai-platform/.env
DATABASE_URL="postgresql://user:password@localhost:5432/youtube_ai"
JWT_SECRET="super-secret-key"
GROQ_API_KEY="gsk_your_actual_key_here"
```

2. **Update `turbo.json` to include GROQ_API_KEY**:
```json
{
  "globalEnv": ["DATABASE_URL", "JWT_SECRET", "GROQ_API_KEY"],
  "tasks": {
    "dev": {
      "env": ["DATABASE_URL", "JWT_SECRET", "GROQ_API_KEY"]
    }
  }
}
```

3. **Restart all services**:
```bash
# Stop current services (Ctrl+C)
npm run dev
```

### How It Works

**Summary Worker** (`apps/summary-worker/`):
1. Listens to the `summarization-processing` queue
2. Fetches video transcript from database
3. Sends transcript to **Groq API** (using Llama 3.3 70B model)
4. Receives structured JSON summary with:
   - Title
   - Short summary
   - Key points
5. Updates database with summary
6. Broadcasts completion via WebSocket

**AI Model Used**: `llama-3.3-70b-versatile`
- Fast inference (< 5 seconds for most videos)
- High-quality summaries
- JSON response format
- Temperature: 0.2 (for consistent results)

### Code Implementation

The summarization is powered by the OpenAI SDK (Groq is OpenAI-compatible):

```typescript
// packages/ai/src/groq.ts
import OpenAI from "openai";

export const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// packages/ai/src/summarize.ts
export async function summarizeTranscript(transcript: string) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are an expert video analyst. Always respond with valid JSON only."
      },
      {
        role: "user",
        content: `Analyze this transcript and return JSON with: title, shortSummary, keyPoints...`
      }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  return completion.choices[0]?.message?.content;
}
```

### Testing Flow

**Complete video processing pipeline**:
1. Upload video URL → Download Worker downloads video
2. Transcription Worker generates transcript (Whisper AI)
3. Summary Worker generates AI summary (Groq)
4. WebSocket updates at each stage
5. Final video object includes: `url`, `transcript`, `summary`

**Real-time updates via WebSocket**:
- `SUMMARY_STATUS: PROCESSING` - When summary generation starts
- `SUMMARY_STATUS: COMPLETED` - When summary is ready
- `SUMMARY_STATUS: FAILED` - If there's an error

### Troubleshooting

**Issue**: `AuthenticationError: 401 Invalid API Key`

**Solutions**:
1. ✅ Verify `GROQ_API_KEY` is in root `.env` file
2. ✅ Ensure `GROQ_API_KEY` is added to `turbo.json` env arrays
3. ✅ Restart all services after adding the key
4. ✅ Check the key starts with `gsk_` (not `AQ.` which is Gemini format)

**Issue**: Gemini quota errors

**Solution**: We've completely switched to Groq - no more Gemini quota issues!

### Free Tier Limits (Groq)

- **Requests per minute**: 30
- **Requests per day**: 14,400
- **Tokens per minute**: 20,000
- **Cost**: $0 (completely free)

This is more than enough for most development and small production use cases.

  This maintains your existing worker pattern and keeps
  the architecture clean and scalable. Each worker handles
   one responsibility with clear queue-based
  communication.
