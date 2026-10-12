# syntax=docker/dockerfile:1.7
# Multi-Stage Production Dockerfile for LogisticQu Backend
# Build Stage
FROM rust:1-bookworm AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifest and dependencies
COPY Cargo.toml Cargo.lock ./
# Copy source, migrations and SQLx offline query metadata (.sqlx)
COPY src ./src
COPY migrations ./migrations
COPY .sqlx ./.sqlx

# Compile optimized release binary.
# SQLX_OFFLINE=true -> query! macros are verified against the committed .sqlx
# metadata, so no database is required at build time (CI / GHCR builds).
ENV SQLX_OFFLINE=true
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo build --release --bin logisticqu-backend \
    && cp target/release/logisticqu-backend /build/logisticqu-backend


# Runtime Stage
FROM debian:bookworm-slim AS runner

# Security: Install ca-certificates and curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Security: Create non-root system user
RUN groupadd -g 10001 logisticqu && \
    useradd -u 10001 -g logisticqu -s /bin/false -M logisticqu

WORKDIR /app

# Copy binary from builder (or precompiled local target)
COPY --from=builder /build/logisticqu-backend /app/logisticqu-backend
COPY --from=builder /build/migrations /app/migrations

# Set ownership
RUN chown -R logisticqu:logisticqu /app

# Switch to non-root user
USER logisticqu

ENV PORT=8080
ENV RUST_LOG=info
ENV TZ=Asia/Makassar

EXPOSE 8080

# Production Health Check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/health || exit 1

CMD ["/app/logisticqu-backend"]
