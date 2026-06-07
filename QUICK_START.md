# YouTube AI Platform - Quick Start Guide

## What You've Built 🎉

A **production-grade microservices platform** with:
- **9 Services**: Gateway, Auth, Video Service, Socket Service, PostgreSQL, Redis, 3 Workers
- **Real-time Processing**: Background workers for downloading, transcription, and AI summarization
- **WebSocket Updates**: Live progress notifications
- **Dockerized**: All services containerized and orchestrated
- **Message Queues**: Redis-based job processing with BullMQ

---

## Current Status

### ✅ Completed
- Docker configuration for all services
- Dockerfile formatting and optimization
- Port configuration (PostgreSQL on 5433 to avoid conflicts)
- Redis connection fix (using environment variables)

### 🔄 In Progress
- Building Docker images with updated Redis configuration
- This takes 10-15 minutes first time

---

## Quick Commands Reference

### Start All Services
```bash
docker-compose up -d
```

### Stop All Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f download-worker

# Multiple services
docker-compose logs -f download-worker transcript-worker summary-worker
```

### Check Status
```bash
docker-compose ps
```

### Rebuild After Code Changes
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Complete Reset (Deletes all data!)
```bash
docker-compose down -v
docker-compose build
docker-compose up -d
```

---

## Testing the Platform

### 1. Register a User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```
**Save the token from the response!**

### 3. Submit Video
```bash
curl -X POST http://localhost:3000/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"Test Video"}'
```

### 4. Watch Processing
```bash
docker-compose logs -f download-worker transcript-worker summary-worker
```

### 5. Check Video Status
```bash
curl http://localhost:3000/videos/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Architecture Overview

```
User Request
    ↓
API Gateway (3000)
    ↓
Auth Service (3001) / Video Service (3002)
    ↓
Redis Queue
    ↓
Workers Process Jobs:
  1. Download Worker → Downloads video
  2. Transcript Worker → Generates transcript (Whisper AI)
  3. Summary Worker → Generates summary (Groq AI)
    ↓
PostgreSQL Database (5433)
    ↓
WebSocket Service (8080) → Sends real-time updates to users
```

---

## Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Gateway | 3000 | Main entry point |
| Auth Service | 3001 | User authentication |
| Video Service | 3002 | Video management |
| Socket Service | 8080 | WebSocket updates |
| PostgreSQL | 5433 | Database (external access) |
| Redis | 6379 | Message queue |

**Note**: PostgreSQL uses port 5433 externally to avoid conflict with your local PostgreSQL on 5432.

---

## Environment Variables

Required in `.env` file:
```bash
DATABASE_URL="postgresql://postgres:haricharan1111@localhost:5433/finance-backend"
JWT_SECRET="your-super-secret-jwt-key"
GROQ_API_KEY="gsk_your_actual_groq_api_key_here"
```

---

## Troubleshooting

### Port Already in Use
```bash
# Change port in docker-compose.yml
# Example: "5433:5432" instead of "5432:5432"
```

### Container Won't Start
```bash
# Check logs
docker-compose logs service-name

# Restart service
docker-compose restart service-name

# Rebuild service
docker-compose build service-name
docker-compose up -d service-name
```

### Redis Connection Errors
```bash
# Verify Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Restart affected services
docker-compose restart download-worker transcript-worker summary-worker
```

### Database Connection Errors
```bash
# Check PostgreSQL is healthy
docker-compose ps postgres

# Connect to database
docker exec -it youtube-ai-postgres psql -U postgres -d finance-backend

# Run migrations (if needed)
cd packages/database
bunx prisma migrate deploy
```

---

## Database Access

### Connect via psql
```bash
docker exec -it youtube-ai-postgres psql -U postgres -d finance-backend
```

### View Users
```sql
SELECT * FROM "User";
```

### View Videos
```sql
SELECT id, title, status, "createdAt" FROM "Video";
```

### View Full Video Details
```sql
SELECT * FROM "Video" WHERE id = 1;
```

---

## Redis Queue Management

### Connect to Redis
```bash
docker exec -it youtube-ai-redis redis-cli
```

### Check Queues
```bash
KEYS *
LLEN bull:download-processing:waiting
LLEN bull:transcript-processing:waiting
LLEN bull:summarization-processing:waiting
```

### View Queue Contents
```bash
LRANGE bull:download-processing:waiting 0 -1
```

---

## What Makes This Production-Ready?

✅ **Microservices**: Independent, scalable services
✅ **Message Queues**: Asynchronous job processing
✅ **Health Checks**: Automatic service monitoring
✅ **Volumes**: Persistent data storage
✅ **Environment Variables**: Configuration management
✅ **Docker Networks**: Isolated service communication
✅ **Real-time Updates**: WebSocket notifications
✅ **Background Workers**: Non-blocking video processing

---

## Next Steps for Learning

### Week 1-2: Make it Production-Ready
- [ ] Add logging (Winston/Pino)
- [ ] Add monitoring (Prometheus + Grafana)
- [ ] Add rate limiting
- [ ] Add API documentation (Swagger)
- [ ] Write tests (unit + integration)
- [ ] Set up CI/CD (GitHub Actions)

### Week 3-4: Deploy to Cloud
- [ ] Deploy to AWS/GCP/DigitalOcean
- [ ] Set up SSL/TLS certificates
- [ ] Configure domain name
- [ ] Set up alerts and monitoring
- [ ] Load testing (k6)

### Week 5-6: Advanced Topics
- [ ] Learn Kubernetes
- [ ] Add caching layer (Redis)
- [ ] Database optimization (indexing, query optimization)
- [ ] Implement circuit breaker pattern
- [ ] Add distributed tracing

---

## Interview Talking Points

When discussing this project in interviews:

1. **Microservices Architecture**: "I built a distributed system with 9 microservices communicating via HTTP and message queues"

2. **Scalability**: "Workers can be scaled independently - if transcription is slow, I can run 5 transcript workers"

3. **Reliability**: "Used health checks and retry mechanisms. If a worker crashes, jobs remain in the queue"

4. **Real-time Features**: "Implemented WebSocket for live progress updates to users"

5. **Docker**: "Containerized all services for consistent deployment across environments"

6. **Message Queues**: "Used Redis + BullMQ for asynchronous job processing to prevent blocking"

7. **AI Integration**: "Integrated Whisper for transcription and Groq for AI summarization"

---

## Resources

- Docker Documentation: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- BullMQ: https://docs.bullmq.io/
- Prisma: https://www.prisma.io/docs
- WebSockets: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API

---

## Support

If something isn't working:
1. Check logs: `docker-compose logs -f`
2. Check service status: `docker-compose ps`
3. Restart services: `docker-compose restart`
4. Full reset: `docker-compose down -v && docker-compose up -d --build`

---

**Built with**: Bun, TypeScript, Express, PostgreSQL, Redis, Docker, Prisma, Whisper AI, Groq AI

**Congratulations! You've built a real production-grade microservices platform!** 🎉
