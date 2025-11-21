#!/bin/bash

# Kubernetes Deployment Script
# Prerequisites: kubectl, docker, k8s cluster running

set -e

NAMESPACE=whiteboard
DOCKER_REGISTRY=${DOCKER_REGISTRY:-docker.io}
DOCKER_USERNAME=${DOCKER_USERNAME:-your-username}
IMAGE_TAG=${IMAGE_TAG:-latest}

echo "🚀 Starting Kubernetes deployment..."

# Create namespace
echo "📦 Creating namespace..."
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Build images
echo "📦 Building Docker images..."
docker build -t ${DOCKER_REGISTRY}/${DOCKER_USERNAME}/whiteboard-backend:${IMAGE_TAG} .
docker build -t ${DOCKER_REGISTRY}/${DOCKER_USERNAME}/whiteboard-frontend:${IMAGE_TAG} \
  -f whiteboard-frontend/Dockerfile whiteboard-frontend/

# Push images to registry
echo "🔐 Pushing images to registry..."
docker push ${DOCKER_REGISTRY}/${DOCKER_USERNAME}/whiteboard-backend:${IMAGE_TAG}
docker push ${DOCKER_REGISTRY}/${DOCKER_USERNAME}/whiteboard-frontend:${IMAGE_TAG}

# Update image references in k8s manifests
echo "📝 Updating Kubernetes manifests..."
sed -i "s|whiteboard-backend:latest|${DOCKER_REGISTRY}/${DOCKER_USERNAME}/whiteboard-backend:${IMAGE_TAG}|g" k8s-deployment.yaml
sed -i "s|whiteboard-frontend:latest|${DOCKER_REGISTRY}/${DOCKER_USERNAME}/whiteboard-frontend:${IMAGE_TAG}|g" k8s-deployment.yaml

# Apply Kubernetes manifests
echo "🚀 Applying Kubernetes manifests..."
kubectl apply -f k8s-deployment.yaml

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s \
  deployment/whiteboard-backend -n ${NAMESPACE}
kubectl wait --for=condition=available --timeout=300s \
  deployment/whiteboard-frontend -n ${NAMESPACE}

# Get service endpoints
echo "
✅ Kubernetes Deployment completed!

Service Status:
"
kubectl get svc -n ${NAMESPACE}

echo "
Port forward for local access:
kubectl port-forward -n ${NAMESPACE} svc/whiteboard-backend 8081:8081
kubectl port-forward -n ${NAMESPACE} svc/whiteboard-frontend 3000:80

View logs:
kubectl logs -n ${NAMESPACE} -l app=whiteboard-backend -f
kubectl logs -n ${NAMESPACE} -l app=whiteboard-frontend -f

Monitor resources:
kubectl top nodes
kubectl top pods -n ${NAMESPACE}
"
