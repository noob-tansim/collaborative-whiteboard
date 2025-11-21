#!/bin/bash

# Docker Deployment Script
# Usage: ./deploy-docker.sh [environment]

set -e

ENVIRONMENT=${1:-local}
REGISTRY=${DOCKER_REGISTRY:-docker.io}
USERNAME=${DOCKER_USERNAME:-your-username}

echo "🚀 Starting Docker deployment for environment: $ENVIRONMENT"

# Build backend
echo "📦 Building backend image..."
docker build -t ${REGISTRY}/${USERNAME}/whiteboard-backend:latest \
  -t ${REGISTRY}/${USERNAME}/whiteboard-backend:${ENVIRONMENT} .

# Build frontend
echo "📦 Building frontend image..."
docker build -t ${REGISTRY}/${USERNAME}/whiteboard-frontend:latest \
  -t ${REGISTRY}/${USERNAME}/whiteboard-frontend:${ENVIRONMENT} \
  -f whiteboard-frontend/Dockerfile whiteboard-frontend/

# Push to registry
if [ "$ENVIRONMENT" == "prod" ]; then
  echo "🔐 Pushing to registry..."
  docker push ${REGISTRY}/${USERNAME}/whiteboard-backend:latest
  docker push ${REGISTRY}/${USERNAME}/whiteboard-backend:${ENVIRONMENT}
  docker push ${REGISTRY}/${USERNAME}/whiteboard-frontend:latest
  docker push ${REGISTRY}/${USERNAME}/whiteboard-frontend:${ENVIRONMENT}
fi

# Deploy with docker-compose
if command -v docker-compose &> /dev/null; then
  echo "🚀 Starting services with docker-compose..."
  docker-compose --env-file .env.${ENVIRONMENT} up -d
  
  echo "⏳ Waiting for services to be healthy..."
  sleep 10
  
  echo "✅ Deployment complete!"
  echo "📊 Service status:"
  docker-compose ps
else
  echo "⚠️  docker-compose not found. Please install it or use Docker Compose v2 (docker compose)"
fi

echo "
🎉 Deployment completed!

Services running at:
- Backend: http://localhost:8081
- Frontend: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

View logs with: docker-compose logs -f
"
