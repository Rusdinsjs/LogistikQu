FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled release binary and migrations
COPY target/release/logisticqu-backend /app/logisticqu-backend
COPY migrations /app/migrations

ENV PORT=8080
ENV RUST_LOG=info

EXPOSE 8080

CMD ["/app/logisticqu-backend"]
