# Production Gateway Dockerfile
# Node.js gateway server with WebSocket support for Gnani integration
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY gateway/package.json gateway/package-lock.json* ./
RUN npm ci --only=production

# Copy gateway source code
COPY gateway/ ./

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app ./

# Expose gateway port
EXPOSE 3000

# Environment variables (required)
# - GNANI_API_KEY: Gnani API key
# - ALLOWED_ORIGIN: Allowed WebSocket origin
# - GATEWAY_PORT: Optional port override

# Start the gateway server
CMD ["node", "gateway/server.js"]