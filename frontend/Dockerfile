# Multi-Stage Production Dockerfile for LogisticQu Frontend
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY . .

# Build production assets
RUN pnpm build

# Stage 2: Runtime
FROM nginx:alpine-slim AS runner

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy compiled SPA assets and Nginx configuration
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Production Health Check
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
