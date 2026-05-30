# YouTube AI Platform - Complete Testing Guide

## System Architecture Flow

```
User Request
    ↓
Gateway (Port 3000)
    ↓
Auth Service (Port 3001) / Video Service (Port 3002)
    ↓
Video Service creates DB record & adds to Queue
    ↓
Redis Queue (Port 6379)
    ↓
Download Worker → downloads video → adds to transcriptQueue
    ↓
Transcript Worker → generates transcript → adds to summarizationQueue
    ↓
Summary Worker → generates summary with Gemini AI
    ↓
Database Updated + WebSocket notifications sent
    ↓
Socket Service (Port 8080) → broadcasts to connected clients
```

## Prerequisites

### 1. Install Dependencies
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform
bun install
```

### 2. Start PostgreSQL
Ensure PostgreSQL is running on `localhost:5432`

### 3. Start Redis
```bash
# Install Redis if not installed (macOS)
brew install redis

# Start Redis
redis-server

# Or run in background
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### 4. Run Database Migrations
```bash
cd packages/database
bunx prisma migrate dev
bunx prisma generate
```

### 5. Verify Environment Variables

**Root `.env`:**
```bash
DATABASE_URL="postgresql://postgres:haricharan1111@localhost:5432/finance-backend"
JWT_SECRET="super-secret-key"
```

**`packages/ai/.env`:**
```bash
GEMINI_API_KEY=AIzaSyAb8RN6JfNtOgtYzHe0J9ajKRXWQ9MLhy5A-P0k3csR7caC9hIw
```

## Step-by-Step Testing Process

### Phase 1: Start All Services

Open **7 separate terminal windows/tabs**:

#### Terminal 1: Gateway
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform/apps/gateway
bun run dev
```
Expected output: `Gateway running on port 3000`

#### Terminal 2: Auth Service
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform/apps/auth-service
bun run dev
```
Expected output: `Auth Service running on port 3001`

#### Terminal 3: Video Service
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform/apps/video-service
bun run dev
```
Expected output: `Video Service running on port 3002`

#### Terminal 4: Socket Service
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform/apps/socket-service
bun run dev
```
Expected output: `Socket Service running on port 8080`

#### Terminal 5: Download Worker
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform/apps/download-worker
bun run dev
```
Expected output: `Download Worker Started`

#### Terminal 6: Transcript Worker
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform/apps/transcript-worker
bun run dev
```
Expected output: `Transcript Worker Started`

#### Terminal 7: Summary Worker
```bash
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform/apps/summary-worker
bun run dev
```
Expected output: `Summary Worker Started` and `Connected to Socket Service`

---

### Phase 2: Test Authentication

#### Step 1: Register a User
```bash
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "clxxxxx...",
    "email": "test@example.com",
    "createdAt": "2026-05-30T..."
  }
}
```

#### Step 2: Login
```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**IMPORTANT:** Copy the token from the response. You'll need it for the next steps.

---

### Phase 3: Submit YouTube Video for Processing

#### Step 3: Submit Video URL

Replace `YOUR_TOKEN_HERE` with the token from Step 2:

```bash
curl -X POST http://localhost:3002/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "videoId": "clxxxxx..."
}
```

**IMPORTANT:** Copy the `videoId`. You'll use it to check the status.

---

### Phase 4: Monitor Processing

#### What Happens Next (Automatic Queue Processing):

**1. Download Worker (Terminal 5) logs:**
```
Processing job: <job-id>
Downloading video from: https://www.youtube.com/watch?v=...
Video downloaded successfully: /path/to/video.mp4
Added to transcript queue
```

**2. Transcript Worker (Terminal 6) logs:**
```
Processing Transcript Job: <job-id>
Transcript Generated
Adding video to summarization queue: <videoId>
Added to summarization queue
```

**3. Summary Worker (Terminal 7) logs:**
```
Processing Summarization Job: <job-id>
Fetching transcript for video: <videoId>
Summary generated successfully
Summary saved to database for video: <videoId>
```

**4. Socket Service (Terminal 4) broadcasts:**
```
Broadcasting: SUMMARY_STATUS - PROCESSING
Broadcasting: SUMMARY_STATUS - COMPLETED
```

---

### Phase 5: Check Final Results

#### Option 1: Check Database Directly
```bash
cd packages/database
bunx prisma studio
```

This opens a browser at `http://localhost:5555` where you can:
1. Click on "Video" table
2. Find your video by ID
3. See the `summary` field with JSON data like:
```json
{
  "title": "Video Title",
  "shortSummary": "Brief description...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"]
}
```

#### Option 2: Query Database via CLI
```bash
cd packages/database
bunx prisma db execute --stdin <<EOF
SELECT id, url, status, transcript, summary
FROM "Video"
WHERE id = 'YOUR_VIDEO_ID_HERE';
EOF
```

---

## Expected Timeline

From submitting the video URL to getting the summary:

1. **Download** (30 seconds - 2 minutes) - depends on video size
2. **Transcription** (1-3 minutes) - depends on video length
3. **Summarization** (5-15 seconds) - Gemini API is very fast

**Total Time:** ~2-5 minutes for a typical YouTube video

---

## Monitoring Tips

### Check Redis Queues
```bash
# Connect to Redis
redis-cli

# Check queue lengths
LLEN bull:video-processing:wait
LLEN bull:transcript-processing:wait
LLEN bull:summarization-processing:wait

# Check active jobs
LLEN bull:summarization-processing:active

# Exit
exit
```

### Watch Logs in Real-Time

Add this to any worker terminal to see detailed logs:
```bash
# Example: Watch summary worker with more detail
cd apps/summary-worker
NODE_ENV=development bun run dev
```

---

## Testing with Different Videos

### Short Video (Recommended for first test)
```bash
# 1-2 minute video
"url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" - first YouTube video
```

### Medium Video
```bash
# 5-10 minute video
"url": "https://www.youtube.com/watch?v=9bZkp7q19f0"  # Gangnam Style
```

### Long Video (Test Gemini's context window)
```bash
# 30+ minute video
"url": "https://www.youtube.com/watch?v=YOUR_LONG_VIDEO"
```

---

## Common Issues & Solutions

### Issue 1: "WebSocket not connected"
**Solution:** Make sure Socket Service (Terminal 4) is running before starting Summary Worker

### Issue 2: Redis connection error
```bash
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution:** Start Redis server
```bash
brew services start redis
```

### Issue 3: Database connection error
**Solution:** Check PostgreSQL is running and DATABASE_URL is correct
```bash
psql -U postgres -d finance-backend -c "SELECT 1;"
```

### Issue 4: "No transcript found"
**Solution:** Transcript Worker might have failed. Check:
1. Python virtual environment exists: `apps/transcript-worker/venv_py313/`
2. Whisper is installed: `apps/transcript-worker/transcribe.py` exists
3. Check Transcript Worker logs for errors

### Issue 5: Gemini API error
**Solution:** Verify API key is valid
```bash
cat packages/ai/.env
# Should show: GEMINI_API_KEY=AIza...
```

---

## Verification Checklist

Before testing, verify:

- [ ] PostgreSQL is running (port 5432)
- [ ] Redis is running (port 6379)
- [ ] All 7 services/workers are running
- [ ] You have a valid JWT token
- [ ] Gemini API key is set in `packages/ai/.env`
- [ ] Database migrations are applied

---

## Success Criteria

✅ You'll know it worked when:

1. Video record created with status `PENDING`
2. Download worker logs show video downloaded
3. Transcript worker logs show transcript generated
4. Summary worker logs show "Summary generated successfully"
5. Database shows:
   - `transcript` field populated
   - `summary` field contains JSON with title, shortSummary, keyPoints
   - `status` = "COMPLETED"
   - `summaryStatus` = "COMPLETED" (if field exists)

---

## Advanced: Real-Time WebSocket Testing

To see live updates, create a simple WebSocket client:

```bash
# Install wscat globally
npm install -g wscat

# Connect to Socket Service
wscat -c ws://localhost:8080

# You'll see real-time messages like:
# {"type":"SUMMARY_STATUS","userId":"...","videoId":"...","status":"PROCESSING"}
# {"type":"SUMMARY_STATUS","userId":"...","videoId":"...","status":"COMPLETED","summary":{...}}
```

---

## Next Steps After Successful Test

1. Build a frontend to display summaries
2. Add video listing endpoint (GET /videos)
3. Add retry logic for failed jobs
4. Add video thumbnail extraction
5. Deploy to production

---

## Questions to Ask Yourself

1. Did all 7 services start without errors?
2. Can you see the job moving through queues in Redis?
3. Does Prisma Studio show the summary JSON?
4. Are WebSocket messages being broadcast?

If you answered YES to all, congratulations! Your YouTube AI Platform is working! 🎉
