# Multi-stage build for optimization
FROM node:18-alpine AS base

# Install dependencies for both backend and frontend
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci
RUN cd backend && npm ci
RUN cd frontend && npm ci

# Build frontend
FROM deps AS frontend-builder
WORKDIR /app
COPY frontend/ ./frontend/
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
RUN cd frontend && npm run build

# Build backend
FROM deps AS backend-builder
WORKDIR /app
COPY backend/ ./backend/
COPY --from=deps /app/backend/node_modules ./backend/node_modules
RUN cd backend && npm run build

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Copy built frontend to backend's static serving directory
COPY --from=frontend-builder /app/frontend/build ./backend/dist/frontend/build

# Copy root package.json for npm start command
COPY package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start the application
CMD ["npm", "start"]