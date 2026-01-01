#!/bin/bash

# AWS ECS Deployment Script
# Prerequisites: AWS CLI, Docker, ECR repository setup

set -e

AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
IMAGE_NAME=whiteboard
CLUSTER_NAME=whiteboard-cluster
SERVICE_NAME=whiteboard-backend

echo "🚀 Starting AWS ECS deployment..."

# Authenticate with ECR
echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Create ECR repositories if they don't exist
echo "📦 Creating ECR repositories..."
for repo in whiteboard-backend whiteboard-frontend; do
  aws ecr describe-repositories --repository-names ${repo} --region ${AWS_REGION} 2>/dev/null || \
  aws ecr create-repository --repository-name ${repo} --region ${AWS_REGION}
done

# Build and push backend
echo "📦 Building and pushing backend image..."
docker build -t ${ECR_REGISTRY}/${IMAGE_NAME}-backend:latest \
  -t ${ECR_REGISTRY}/${IMAGE_NAME}-backend:$(date +%s) .
docker push ${ECR_REGISTRY}/${IMAGE_NAME}-backend:latest
docker push ${ECR_REGISTRY}/${IMAGE_NAME}-backend:$(date +%s)

# Build and push frontend
echo "📦 Building and pushing frontend image..."
docker build -t ${ECR_REGISTRY}/${IMAGE_NAME}-frontend:latest \
  -t ${ECR_REGISTRY}/${IMAGE_NAME}-frontend:$(date +%s) \
  -f whiteboard-frontend/Dockerfile whiteboard-frontend/
docker push ${ECR_REGISTRY}/${IMAGE_NAME}-frontend:latest
docker push ${ECR_REGISTRY}/${IMAGE_NAME}-frontend:$(date +%s)

echo "✅ Images pushed to ECR"

# Create ECS cluster if it doesn't exist
echo "🏗️  Setting up ECS cluster..."
aws ecs create-cluster --cluster-name ${CLUSTER_NAME} --region ${AWS_REGION} 2>/dev/null || true

# Register task definitions
echo "📋 Registering ECS task definitions..."
# Update ecs-task-definition.json with your image URIs first

# Update service
echo "🚀 Updating ECS service..."
aws ecs update-service --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} \
  --force-new-deployment --region ${AWS_REGION} || true

echo "
✅ AWS ECS Deployment completed!

Next steps:
1. Update ecs-task-definition.json with your image URIs
2. Create ECS service with: aws ecs create-service
3. Monitor deployment: aws ecs describe-services

View logs in CloudWatch:
aws logs tail /ecs/whiteboard --follow
"
