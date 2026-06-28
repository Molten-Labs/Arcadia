FROM rust:1.89-bookworm AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY server-rs/Cargo.toml server-rs/rust-toolchain.toml ./server-rs/
COPY server-rs/migrations ./server-rs/migrations
COPY server-rs/src ./server-rs/src

RUN cargo build --release --locked -p server-rs

FROM debian:bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/server-rs ./target/release/server-rs

EXPOSE 8080

CMD ["./target/release/server-rs"]
