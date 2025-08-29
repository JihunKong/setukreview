#!/bin/bash

# SetuKReview Docker Deployment Script for AWS EC2

set -e

echo "🚀 Starting SetuKReview deployment to AWS EC2..."

# Configuration
EC2_HOST="43.201.9.224"
EC2_USER="ubuntu" 
KEY_FILE="setukreview.pem"
DOCKER_IMAGE="setukreview:latest"
CONTAINER_NAME="setukreview-app"

# Step 1: Build Docker image locally
echo "🔨 Building Docker image..."
docker build -t $DOCKER_IMAGE .

# Step 2: Save Docker image to tar file
echo "📦 Exporting Docker image..."
docker save $DOCKER_IMAGE > setukreview-image.tar

# Step 3: Copy to EC2
echo "📤 Transferring to EC2 server..."
scp -i $KEY_FILE setukreview-image.tar $EC2_USER@$EC2_HOST:~/

# Step 4: Copy docker-compose.yml
scp -i $KEY_FILE docker-compose.yml $EC2_USER@$EC2_HOST:~/

# Step 5: Deploy on EC2
echo "🚀 Deploying on EC2..."
ssh -i $KEY_FILE $EC2_USER@$EC2_HOST << 'EOF'
  # Load Docker image
  docker load < setukreview-image.tar
  
  # Stop existing container
  docker-compose down || true
  
  # Remove old containers and images
  docker container prune -f
  docker image prune -f
  
  # Create required directories
  sudo mkdir -p /app/logs /app/uploads
  sudo chown -R $USER:$USER /app
  
  # Start services
  docker-compose up -d
  
  # Check status
  echo "📊 Container status:"
  docker-compose ps
  
  # Show logs
  echo "📋 Recent logs:"
  docker-compose logs --tail=20
EOF

# Step 6: Cleanup local files
echo "🧹 Cleaning up..."
rm setukreview-image.tar

# Step 7: Verify deployment
echo "✅ Deployment completed!"
echo "🌐 Frontend: http://$EC2_HOST:3000"
echo "🔧 Backend API: http://$EC2_HOST:3001/api/health"

# Test health endpoint
echo "🏥 Testing health endpoint..."
sleep 10
curl -f http://$EC2_HOST:3001/api/health || echo "❌ Health check failed"

echo "✨ Deployment script completed!"