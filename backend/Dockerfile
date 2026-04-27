## Multi-stage Dockerfile for check-place backend

# Build stage
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-bullseye-slim
WORKDIR /app

# Copy only the built artifacts and runtime deps from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001

CMD [ "node", "dist/index.js" ]
