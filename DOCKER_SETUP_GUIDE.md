# Docker Setup & Testing Guide

This guide provides step-by-step instructions to build, run, and test your YouTube AI Platform using Docker.

---

## Understanding Docker - A Beginner's Guide

### What is Docker?

Imagine you're moving to a new apartment. Instead of packing your belongings in random boxes, you use standardized shipping containers. Each container:
- Has everything inside (furniture, dishes, clothes)
- Can be moved anywhere (truck, ship, train)
- Works the same way regardless of where it goes
- Doesn't affect other containers

**Docker does the same thing for software applications!**

A Docker container packages your application with everything it needs:
- Your code
- Programming language runtime (Node.js, Python, Bun)
- System libraries and tools
- Configuration files

### Why is Docker Important for Backend Development?

#### 1. **"It Works on My Machine" Problem - SOLVED**

**Without Docker:**
```
Developer: "The app works fine on my laptop!"
Server: "Error: Python version mismatch"
Developer: "But I have Python 3.11..."
Server: "I have Python 3.8"
Developer: *spends 3 hours debugging* 😩
```

**With Docker:**
```
Developer: "Here's the Docker image"
Server: *runs the exact same environment*
Server: "It works!" ✅
Developer: "Of course it does!" 😎
```

#### 2. **Simplified Setup**

**Without Docker:**
- Install PostgreSQL (30 minutes)
- Install Redis (20 minutes)
- Install Python, Node.js, FFmpeg (1 hour)
- Configure each service (2 hours)
- Fix version conflicts (3 hours)
- **Total: 6+ hours** 😫

**With Docker:**
```bash
docker-compose up -d
# Done in 10 minutes! ✅
```

#### 3. **Isolation - Services Don't Fight**

Your laptop might have:
- Project A needs Node 16
- Project B needs Node 20
- Project C needs Python 3.9
- Project D needs Python 3.11

**Without Docker:** Version conflicts everywhere! 😱

**With Docker:** Each project runs in its own container with its own versions. No conflicts! 🎉

#### 4. **Microservices Architecture**

Your YouTube AI Platform has 9 different services:
- Gateway
- Auth Service
- Video Service
- Socket Service
- 3 Workers (Download, Transcript, Summary)
- PostgreSQL
- Redis

**Docker lets each service:**
- Run independently
- Scale independently (run 5 transcript workers if needed)
- Fail without crashing other services
- Use different programming languages (Bun, Python, etc.)

#### 5. **Production = Development**

The same Docker setup you use on your laptop:
- Works on your teammate's Windows PC
- Works on the production server
- Works on AWS, Google Cloud, Azure
- **No surprises in production!**

---

## How Dockerfiles Work - The Blueprint

A **Dockerfile** is like a recipe that tells Docker how to build your application container.

### Anatomy of a Dockerfile (Using Gateway as Example)

```dockerfile
# 1. BASE IMAGE - The foundation
FROM oven/bun:1.2.21-slim
# Like saying "Start with a house that already has plumbing"
# This gives us: Linux + Bun runtime

# 2. WORK DIRECTORY - Where your code lives
WORKDIR /app
# Like saying "All work happens in the /app folder"

# 3. INSTALL SYSTEM TOOLS
RUN apt-get update && apt-get install -y curl
# Like installing utilities in your house (hammer, screwdriver)
# curl is needed for health checks

# 4. COPY DEPENDENCY FILES FIRST (for caching)
COPY package.json bun.lock ./
COPY apps/gateway/package.json ./apps/gateway/
# Copy only dependency files first - Docker caching optimization!

# 5. INSTALL DEPENDENCIES
RUN bun install
# Like buying furniture and appliances for the house
# This installs all npm/bun packages

# 6. COPY APPLICATION CODE
COPY apps/gateway ./apps/gateway
COPY turbo.json ./
# Now bring in your actual application code

# 7. EXPOSE PORT
EXPOSE 3000
# Like putting a doorbell on port 3000
# "Hey! I'm listening on port 3000 for requests"

# 8. HEALTH CHECK
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
# Periodically checks "Is this service alive?"

# 9. START COMMAND
CMD ["bun", "run", "apps/gateway/src/index.ts"]
# The command to run when container starts
# Like flipping the light switch when you enter the house
```

### Why Copy Files in This Order?

**Docker uses layers and caching:**

```dockerfile
# If you change code, Docker only rebuilds from this point down ⬇️
COPY package.json bun.lock ./        # Layer 1 (rarely changes)
RUN bun install                      # Layer 2 (cached if Layer 1 unchanged)
COPY apps/gateway ./apps/gateway     # Layer 3 (changes often)
```

**Smart!** If you only change code, Docker reuses the cached `bun install` layer. Builds finish in 10 seconds instead of 5 minutes!

---

## Understanding Ports - The Doorways

### What Are Ports?

Think of your computer as a giant apartment building:
- Each apartment (service) has a number (port)
- Mail (network requests) needs the apartment number to find you

**Common ports in your project:**
- **3000** - Gateway (main entrance)
- **3001** - Auth Service
- **3002** - Video Service
- **8080** - WebSocket Service
- **5432** - PostgreSQL Database
- **6379** - Redis Queue

### Port Mapping: Inside vs Outside

In docker-compose.yml you see:
```yaml
ports:
  - "3000:3000"
```

This means:
```
"HOST_PORT:CONTAINER_PORT"
"Outside:Inside"
```

**Example:**
```yaml
ports:
  - "8080:3000"
```

- **Container thinks**: "I'm running on port 3000" (inside the container)
- **Your laptop accesses**: `localhost:8080` (outside the container)
- Docker forwards `8080` → `3000`

**Why does this matter?**

If port 3000 is already taken on your laptop:
```yaml
gateway:
  ports:
    - "3001:3000"  # Access via localhost:3001
```

The gateway still thinks it's on 3000 (inside), but you access it via 3001 (outside).

---

## How Services Communicate - The Network

### Inside Docker Network

All containers in `docker-compose.yml` share a private network:

```yaml
services:
  gateway:        # hostname: "gateway"
  auth-service:   # hostname: "auth-service"
  postgres:       # hostname: "postgres"
```

**Gateway can talk to auth-service:**
```javascript
// Inside gateway container
fetch('http://auth-service:3001/login')
// Uses hostname, not localhost!
```

**Why not `localhost`?**
- `localhost` means "myself" (the gateway container)
- `auth-service` means "the other container named auth-service"

### Real-World Example from Your Project

```yaml
# Gateway configuration
gateway:
  environment:
    - AUTH_SERVICE_URL=http://auth-service:3001
    - VIDEO_SERVICE_URL=http://video-service:3002
```

When gateway receives `/auth/login`:
1. Gateway: "Let me forward this to auth-service"
2. Gateway makes request to `http://auth-service:3001/login`
3. Docker routes request to auth-service container
4. Auth-service responds
5. Gateway returns response to user

**From outside (your laptop):**
```bash
curl http://localhost:3000/auth/login
# Goes to gateway on port 3000
```

**Inside Docker network:**
```javascript
// Gateway forwards to
http://auth-service:3001/login
// Using container hostname
```

---

## How Workers Work - The Background Heroes

### What Are Workers?

**Regular Services (Gateway, Auth, Video):**
- Wait for HTTP requests
- Respond immediately
- Synchronous: "Ask me, I answer"

**Workers:**
- Check a queue for jobs
- Process jobs in background
- Asynchronous: "Add job to queue, I'll handle it when I can"

### Why Use Workers?

**Imagine without workers:**

```javascript
// User uploads video
POST /videos
  |
  v
Download video (2 minutes) ⏳
  |
  v
Generate transcript (5 minutes) ⏳
  |
  v
Generate summary (10 seconds) ⏳
  |
  v
Return response after 7+ minutes! 😱
```

**User experience:** "Why is the page loading for 7 minutes?!"

**With workers:**

```javascript
// User uploads video
POST /videos
  |
  v
Add job to queue
  |
  v
Return immediately: "We're processing your video!" ✅
(User sees response in 1 second)

Meanwhile, in the background:
Download Worker → processes job (2 min)
Transcript Worker → processes job (5 min)
Summary Worker → processes job (10 sec)

WebSocket → sends updates in real-time!
"Downloading... ✅"
"Transcribing... ✅"
"Summarizing... ✅"
"Done! ✅"
```

### Worker Architecture in Your Project

```
Video Service
      ↓ (adds job)
Redis Queue: [job1, job2, job3]
      ↓ (worker picks job)
Download Worker
      ↓ (job complete, add next job)
Redis Queue: [transcribe-job1]
      ↓ (worker picks job)
Transcript Worker
      ↓ (job complete, add next job)
Redis Queue: [summarize-job1]
      ↓ (worker picks job)
Summary Worker
      ↓ (job complete)
Update Database
```

**Each worker:**
1. Connects to Redis
2. Listens for jobs on its queue
3. Processes job when available
4. Updates database
5. Broadcasts update via WebSocket
6. Waits for next job

### Benefits of Worker Pattern

**1. Scalability**
```yaml
# Need more speed? Run 5 transcript workers!
transcript-worker:
  deploy:
    replicas: 5
```

**2. Reliability**
- If a worker crashes, the job stays in queue
- Restart worker, it picks up where it left off

**3. Resource Management**
- Transcript worker uses lots of CPU? Give it more resources
- Other services unaffected

**4. Priority Queues**
- Premium users get priority queue
- Regular users get standard queue

---

## Benefits of Docker for Learning Backend

### 1. **Learn Industry Standards**

90% of companies use Docker in production. Learning Docker = Learning real-world skills.

### 2. **Experiment Safely**

```bash
# Try something crazy
docker-compose up -d

# Broke everything?
docker-compose down -v
# Back to clean slate in 5 seconds!
```

### 3. **Understand Microservices**

Without Docker, running 9 services simultaneously is a nightmare.
With Docker: `docker-compose up` 🎉

### 4. **Learn DevOps Concepts**

Docker teaches you:
- **Container orchestration** (docker-compose)
- **Environment variables** (configuration)
- **Networking** (how services talk)
- **Health checks** (monitoring)
- **Volumes** (data persistence)
- **Logging** (debugging)

These are crucial DevOps skills!

### 5. **Portfolio Projects**

Recruiters love Docker:
- "Look! My project runs with one command"
- "Here's the docker-compose.yml - try it yourself"
- Shows you understand production-ready systems

### 6. **Debugging Skills**

```bash
# View logs
docker-compose logs gateway

# Enter container (like SSH)
docker exec -it youtube-ai-gateway /bin/sh

# Check processes
docker stats

# Inspect networks
docker network inspect youtube-ai-platform_default
```

Learning to debug Dockerized apps = valuable skill.

### 7. **Cost Savings in Learning**

**Without Docker:**
- Need multiple VPS servers ($50/month)
- Or complex setup on one server (hours of work)

**With Docker:**
- Run everything on your laptop ($0)
- Deploy to one cheap VPS later ($5/month)

---

## Docker vs Traditional Deployment

### Traditional Way (The Old Days)

```bash
# On production server
ssh user@server
sudo apt-get install postgresql
sudo apt-get install redis
sudo apt-get install nodejs
sudo npm install
# Configure nginx
# Configure firewall
# Set up environment variables
# Start services manually
# Hope nothing breaks 🤞
```

**Problems:**
- Takes hours to setup
- Different from your laptop
- Hard to replicate
- "Works on my machine" syndrome
- Manual scaling
- Difficult rollbacks

### Docker Way (Modern)

```bash
# On production server
git clone repo
docker-compose up -d
# Done! ✅
```

**Benefits:**
- Same environment everywhere
- Easy to scale
- One-command rollback
- Isolated services
- Easy monitoring
- Reproducible builds

---

## Real-World Analogy: Restaurant Kitchen

### Without Docker (Traditional Kitchen)

- **Chef 1** makes pasta using Stove A
- **Chef 2** makes pizza using Oven B
- **Chef 3** makes salad using Counter C

**Problems:**
- Chefs fight over equipment
- If one chef makes a mess, affects others
- Hard to add more chefs (not enough space)
- New chef needs training on this specific kitchen

### With Docker (Modern Kitchen with Stations)

- **Chef 1** has complete pasta station (stove, pots, ingredients)
- **Chef 2** has complete pizza station (oven, dough, toppings)
- **Chef 3** has complete salad station (counter, veggies, dressing)

**Benefits:**
- Chefs work independently
- Stations don't interfere with each other
- Need more pizzas? Add more pizza stations!
- New chef? Give them a pre-configured station
- If one station breaks, others keep working

**This is exactly how Docker works with your microservices!**

---

## Key Docker Concepts Explained Simply

### 1. Image vs Container

**Image** = Recipe / Blueprint
- Read-only template
- Contains instructions to create a container
- Can be shared (Docker Hub)

**Container** = The actual running instance
- Created from an image
- Running process
- Has its own memory, CPU, storage

**Analogy:**
- **Image** = Architectural blueprint of a house
- **Container** = The actual house built from that blueprint

You can build 100 houses (containers) from one blueprint (image).

### 2. Volumes - Persistent Data

**Problem:** Containers are ephemeral (temporary)
```bash
docker-compose down
# Container deleted
# All data inside gone! 💀
```

**Solution:** Volumes
```yaml
volumes:
  postgres_data:/var/lib/postgresql/data
```

**Analogy:**
- Container = Hotel room (temporary)
- Volume = Storage unit (permanent)
- Your important data stays in storage, even when you check out

### 3. docker-compose - The Orchestra Conductor

Instead of running 9 docker commands:
```bash
docker run postgres...
docker run redis...
docker run gateway...
# ... 6 more times
```

Use docker-compose:
```bash
docker-compose up
# Starts all 9 services in the right order!
```

**docker-compose.yml** = Musical score for orchestra conductor

### 4. Health Checks - The Doctor

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 3s
  retries: 3
```

**What this does:**
- Every 30 seconds, check if service is alive
- If check fails 3 times, mark as unhealthy
- Other services can wait for healthy status

**Analogy:** Doctor checks your heartbeat every 30 seconds

### 5. Environment Variables - The Configuration

```yaml
environment:
  - DATABASE_URL=postgresql://...
  - JWT_SECRET=secret123
  - REDIS_HOST=redis
```

**Why use environment variables?**
- Different configs for dev/staging/production
- Keep secrets out of code
- Easy to change without rebuilding

**Example:**
```bash
# Development
DATABASE_URL=localhost:5432

# Production
DATABASE_URL=prod-db.amazonaws.com:5432
```

Same code, different config!

---

## Prerequisites

Before starting, make sure you have the following installed:

1. **Docker** (version 20.10 or higher)
   ```bash
   docker --version
   ```

2. **Docker Compose** (version 2.0 or higher)
   ```bash
   docker-compose --version
   ```

3. **Groq API Key** (for AI summarization)
   - Sign up at: https://console.groq.com
   - Create an API key (starts with `gsk_...`)

## Step 1: Environment Configuration

### Create .env file in the project root

```bash
# Navigate to project root
cd /Users/haricharan/Documents/web\ development/System-Design/youtube-ai-platform

# Create .env file
cat > .env << 'EOF'
# Database Configuration
DATABASE_URL="postgresql://postgres:haricharan1111@localhost:5432/finance-backend"

# JWT Secret (change this in production!)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Groq AI API Key (get from https://console.groq.com)
GROQ_API_KEY="gsk_your_actual_groq_api_key_here"
EOF
```

**IMPORTANT**: Replace `gsk_your_actual_groq_api_key_here` with your actual Groq API key!

### Verify .env file

```bash
cat .env
```

You should see all three environment variables properly set.

## Step 2: Build Docker Images

Build all Docker images for your services:

```bash
# Build all services (this will take 5-10 minutes first time)
docker-compose build

# Or build with no cache (if you made changes)
docker-compose build --no-cache
```

**What this does:**
- Builds 8 Docker images: postgres, redis, gateway, auth-service, video-service, socket-service, download-worker, transcript-worker, summary-worker
- Installs all dependencies (Bun packages, Python packages, yt-dlp, ffmpeg, Whisper AI)
- Sets up Python virtual environments for workers

## Step 3: Start All Services

### Start in detached mode (background)

```bash
docker-compose up -d
```

### Start with logs visible (foreground)

```bash
docker-compose up
```

**Services started:**
- PostgreSQL (port 5432) - Database
- Redis (port 6379) - Message queue
- Gateway (port 3000) - API Gateway
- Auth Service (port 3001) - Authentication
- Video Service (port 3002) - Video management
- Socket Service (port 8080) - WebSocket updates
- Download Worker - Downloads YouTube videos
- Transcript Worker - Generates transcripts
- Summary Worker - Generates AI summaries

### Check service status

```bash
# View all running containers
docker-compose ps

# View logs from all services
docker-compose logs

# View logs from specific service
docker-compose logs gateway
docker-compose logs download-worker
docker-compose logs -f summary-worker  # Follow logs in real-time
```

## Step 4: Verify Services Are Running

### Check health of services

```bash
# Gateway health check
curl http://localhost:3000/health

# Auth service health check
curl http://localhost:3001/health

# Video service health check
curl http://localhost:3002/health

# Socket service health check
curl http://localhost:8080/health
```

Each should return a JSON response with `{"status": "ok"}` or similar.

### Check database connection

```bash
# Connect to PostgreSQL container
docker exec -it youtube-ai-postgres psql -U postgres -d finance-backend

# Inside PostgreSQL, run:
\dt          # List tables
\q           # Quit
```

### Check Redis connection

```bash
# Connect to Redis container
docker exec -it youtube-ai-redis redis-cli

# Inside Redis, run:
PING         # Should return "PONG"
KEYS *       # List all keys (queues)
exit         # Quit
```

## Step 5: Test the Complete Flow

### 5.1 Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

**Expected response:**
```json
{
  "id": 1,
  "email": "test@example.com"
}
```

### 5.2 Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

**Expected response:**
```json
{
  "token": "your.jwt.token.here",
  "user": {
    "id": 1,
    "email": "test@example.com"
  }
}
```

**IMPORTANT:** Copy the JWT token from the response - you'll need it for the next steps!

### 5.3 Submit a YouTube Video for Processing

Replace `YOUR_JWT_TOKEN` with the token from step 5.2:

```bash
curl -X POST http://localhost:3000/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "Test Video"
  }'
```

**Expected response:**
```json
{
  "id": 1,
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Test Video",
  "status": "PENDING",
  "userId": 1
}
```

### 5.4 Monitor Video Processing

Watch the logs to see the processing pipeline in action:

```bash
# Open multiple terminal windows and run these commands:

# Terminal 1: Download Worker
docker-compose logs -f download-worker

# Terminal 2: Transcript Worker
docker-compose logs -f transcript-worker

# Terminal 3: Summary Worker
docker-compose logs -f summary-worker

# Terminal 4: Socket Service
docker-compose logs -f socket-service
```

**Processing flow:**
1. **Download Worker**: Downloads video from YouTube (30 seconds - 2 minutes)
2. **Transcript Worker**: Generates transcript using Whisper AI (1-5 minutes)
3. **Summary Worker**: Generates AI summary using Groq (5-10 seconds)
4. **Socket Service**: Broadcasts updates at each stage

### 5.5 Check Video Status

```bash
# Get all videos for the user
curl -X GET http://localhost:3000/videos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get specific video
curl -X GET http://localhost:3000/videos/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected response (after processing completes):**
```json
{
  "id": 1,
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Test Video",
  "status": "COMPLETED",
  "transcript": "Full transcript text here...",
  "summary": {
    "title": "Video Title",
    "shortSummary": "Brief summary...",
    "keyPoints": ["Point 1", "Point 2", "Point 3"]
  },
  "userId": 1,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

## Step 6: Test WebSocket Real-Time Updates

Create a simple HTML file to test WebSocket connections:

```bash
cat > websocket-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
</head>
<body>
    <h1>WebSocket Real-Time Updates</h1>
    <div id="status">Connecting...</div>
    <ul id="messages"></ul>

    <script>
        const ws = new WebSocket('ws://localhost:8080');

        ws.onopen = () => {
            document.getElementById('status').textContent = 'Connected';
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received:', data);

            const li = document.createElement('li');
            li.textContent = JSON.stringify(data, null, 2);
            document.getElementById('messages').appendChild(li);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            document.getElementById('status').textContent = 'Error';
        };

        ws.onclose = () => {
            document.getElementById('status').textContent = 'Disconnected';
            console.log('WebSocket disconnected');
        };
    </script>
</body>
</html>
EOF
```

Open `websocket-test.html` in your browser and watch for real-time updates when processing videos.

## Step 7: Inspect Database

### View database tables

```bash
docker exec -it youtube-ai-postgres psql -U postgres -d finance-backend -c "\dt"
```

### View users

```bash
docker exec -it youtube-ai-postgres psql -U postgres -d finance-backend -c "SELECT * FROM \"User\";"
```

### View videos

```bash
docker exec -it youtube-ai-postgres psql -U postgres -d finance-backend -c "SELECT id, title, status, \"createdAt\" FROM \"Video\";"
```

### View video details (with transcript and summary)

```bash
docker exec -it youtube-ai-postgres psql -U postgres -d finance-backend -c "SELECT * FROM \"Video\" WHERE id = 1;"
```

## Step 8: Inspect Redis Queues

```bash
# Connect to Redis
docker exec -it youtube-ai-redis redis-cli

# Inside Redis:
KEYS *                                    # See all queues
LLEN bull:download-processing:waiting     # Check download queue length
LLEN bull:transcript-processing:waiting   # Check transcript queue length
LLEN bull:summarization-processing:waiting # Check summary queue length

# View queue contents
LRANGE bull:download-processing:waiting 0 -1
LRANGE bull:transcript-processing:waiting 0 -1

exit
```

## Troubleshooting

### Service won't start

```bash
# Check logs for specific service
docker-compose logs auth-service
docker-compose logs video-service

# Restart specific service
docker-compose restart auth-service

# Rebuild and restart
docker-compose up -d --build auth-service
```

### Database connection errors

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Verify DATABASE_URL in .env matches docker-compose.yml
cat .env | grep DATABASE_URL
```

### "API Key Invalid" errors

```bash
# Verify GROQ_API_KEY is set
cat .env | grep GROQ_API_KEY

# Restart summary-worker to pick up new env vars
docker-compose restart summary-worker

# Check summary-worker logs
docker-compose logs summary-worker
```

### Worker not processing jobs

```bash
# Check if Redis is running
docker-compose ps redis

# Check worker logs
docker-compose logs download-worker
docker-compose logs transcript-worker
docker-compose logs summary-worker

# Restart workers
docker-compose restart download-worker transcript-worker summary-worker
```

### Port conflicts

If you see "port already in use" errors:

```bash
# Check what's using the port (example for port 3000)
lsof -i :3000

# Kill the process or change the port in docker-compose.yml
# For example, change:
#   ports:
#     - "3000:3000"
# To:
#   ports:
#     - "3001:3000"  # External:Internal
```

### Clear all data and start fresh

```bash
# Stop all services
docker-compose down

# Remove volumes (deletes all data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild and start
docker-compose up -d --build
```

## Stopping Services

### Stop all services (keeps data)

```bash
docker-compose stop
```

### Stop and remove containers (keeps data)

```bash
docker-compose down
```

### Stop and remove everything including volumes (deletes all data!)

```bash
docker-compose down -v
```

## Performance Tips

### View resource usage

```bash
# Check CPU and memory usage
docker stats

# Check disk usage
docker system df
```

### Limit resource usage

Edit `docker-compose.yml` and add resource limits:

```yaml
services:
  transcript-worker:
    # ... other config
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          memory: 512M
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a secure random string
- [ ] Change `POSTGRES_PASSWORD` to a strong password
- [ ] Use a proper PostgreSQL database (not the Docker container)
- [ ] Set up Redis persistence (`appendonly yes`)
- [ ] Add HTTPS/TLS certificates
- [ ] Set up proper logging and monitoring
- [ ] Configure backups for PostgreSQL
- [ ] Use Docker secrets for sensitive data
- [ ] Set resource limits for all services
- [ ] Use a production-ready Groq API key
- [ ] Add rate limiting to API endpoints

## Summary of Common Commands

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart gateway

# Execute command in container
docker exec -it youtube-ai-postgres psql -U postgres

# View running containers
docker-compose ps

# Check resource usage
docker stats
```

## Next Steps

1. Build a frontend application to interact with the API
2. Add user authentication with proper password hashing
3. Implement video thumbnails
4. Add support for different video platforms
5. Implement video search and filtering
6. Add user dashboard with statistics
7. Set up CI/CD pipeline
8. Deploy to cloud (AWS, GCP, Azure)

---

**Need help?** Check the logs with `docker-compose logs -f` to see what's happening!
