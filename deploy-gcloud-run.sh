#!/bin/bash

# Google Cloud Run Deployment Script
# Prerequisites: gcloud CLI, Docker, GCP project setup

set -e

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-your-project-id}
REGION=${GOOGLE_CLOUD_REGION:-us-central1}
REGISTRY=${REGION}-docker.pkg.dev
REPOSITORY=whiteboard

echo "🚀 Starting Google Cloud Run deployment..."

# Authenticate
echo "🔐 Authenticating with GCP..."
gcloud auth configure-docker ${REGISTRY}

# Create Artifact Registry repository
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create ${REPOSITORY} \
  --repository-format=docker \
  --location=${REGION} \
  --project=${PROJECT_ID} 2>/dev/null || true

# Build and push backend
echo "📦 Building and pushing backend image..."
gcloud builds submit \
  --tag ${REGISTRY}/${PROJECT_ID}/${REPOSITORY}/backend:latest \
  --project=${PROJECT_ID}

# Build and push frontend
echo "📦 Building and pushing frontend image..."
gcloud builds submit \
  --tag ${REGISTRY}/${PROJECT_ID}/${REPOSITORY}/frontend:latest \
  --gcloud-args="-f=whiteboard-frontend/Dockerfile" \
  --project=${PROJECT_ID}

# Deploy backend to Cloud Run
echo "🚀 Deploying backend to Cloud Run..."
gcloud run deploy whiteboard-backend \
  --image ${REGISTRY}/${PROJECT_ID}/${REPOSITORY}/backend:latest \
  --platform managed \
  --region ${REGION} \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars SPRING_PROFILES_ACTIVE=prod \
  --project=${PROJECT_ID} \
  --allow-unauthenticated

# Deploy frontend to Cloud Run
echo "🚀 Deploying frontend to Cloud Run..."
gcloud run deploy whiteboard-frontend \
  --image ${REGISTRY}/${PROJECT_ID}/${REPOSITORY}/frontend:latest \
  --platform managed \
  --region ${REGION} \
  --memory 256Mi \
  --cpu 1 \
  --project=${PROJECT_ID} \
  --allow-unauthenticated

echo "
✅ Google Cloud Run Deployment completed!

Services deployed at:
- Backend: https://whiteboard-backend-<hash>.a.run.app
- Frontend: https://whiteboard-frontend-<hash>.a.run.app

View logs:
gcloud run logs read whiteboard-backend --limit 50

View services:
gcloud run services list --region ${REGION}
"
