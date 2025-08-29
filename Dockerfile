# Multi-stage Docker build for SetuKReview

# Stage 1: Build Frontend
FROM node:18-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine as backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:18-alpine
WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy built backend
COPY --from=backend-build /app/backend/dist ./backend/
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules/
COPY --from=backend-build /app/backend/package*.json ./backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/build ./frontend/build/

# Install serve to serve static files
RUN npm install -g serve

# Create PM2 ecosystem file
COPY docker-ecosystem.config.js ./

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start services with PM2
CMD ["pm2-runtime", "start", "docker-ecosystem.config.js"]