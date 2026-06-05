FROM rust:1.82-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates pkg-config libssl-dev \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci
RUN npm run build
RUN npm run server:prepare-web
RUN cargo build --release -p trace-server

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/trace-server /usr/local/bin/trace-server

VOLUME ["/data"]
EXPOSE 8080

ENV TRACE_DATA_DIR=/data
ENV TRACE_BIND=0.0.0.0:8080

CMD ["trace-server"]
