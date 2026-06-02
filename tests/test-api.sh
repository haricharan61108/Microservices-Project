#!/bin/bash

echo "Testing YouTube AI Platform..."

# Register
echo "1. Registering user..."
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -s | jq

# Login
echo ""
echo "2. Logging in..."
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -s | jq -r '.token')

echo "Token: $TOKEN"

# Submit video
echo ""
echo "3. Submitting video..."
curl -X POST http://localhost:3000/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"Test Video"}' \
  -s | jq

echo ""
echo "Done! Watch logs with: docker-compose logs -f"
