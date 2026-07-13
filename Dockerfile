# ── Build stage ────────────────────────────────────────────────────────────────
FROM rust:1.89-bookworm AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Toolchain file lives at the repo root (not inside server-rs/)
COPY rust-toolchain.toml ./

# ── Layer 1: workspace manifests only (maximises Docker cache hits) ──────────
# The server-rs/ directory IS the Cargo workspace root
COPY server-rs/Cargo.toml server-rs/Cargo.lock ./
COPY server-rs/bin/Cargo.toml          ./bin/
COPY server-rs/crates/api/Cargo.toml     ./crates/api/
COPY server-rs/crates/chain/Cargo.toml   ./crates/chain/
COPY server-rs/crates/core/Cargo.toml    ./crates/core/
COPY server-rs/crates/db/Cargo.toml      ./crates/db/
COPY server-rs/crates/decode/Cargo.toml  ./crates/decode/
COPY server-rs/crates/prices/Cargo.toml  ./crates/prices/
COPY server-rs/crates/scoring/Cargo.toml ./crates/scoring/
COPY server-rs/crates/workers/Cargo.toml ./crates/workers/

# ── Layer 2: stub sources so Cargo can resolve + compile all dependencies ────
RUN mkdir -p \
      bin/src \
      crates/api/src \
      crates/chain/src \
      crates/core/src \
      crates/db/src \
      crates/decode/src \
      crates/prices/src \
      crates/scoring/src \
      crates/workers/src \
  && echo 'fn main() {}' > bin/src/main.rs \
  && for crate in api chain core db decode prices scoring workers; do \
       echo 'pub fn _stub() {}' > crates/$crate/src/lib.rs; \
     done

# Compile dependencies only; the stub build will fail but deps are cached
RUN cargo build --release --locked -p arcadia-server 2>/dev/null; true

# ── Layer 3: real source trees ───────────────────────────────────────────────
COPY server-rs/bin     ./bin
COPY server-rs/crates  ./crates

# Bump mtimes so Cargo knows to recompile after the stub pass
RUN touch bin/src/main.rs \
  && for f in crates/*/src/lib.rs; do touch "$f"; done

# Final release build
RUN cargo build --release --locked -p arcadia-server

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/arcadia-server ./arcadia-server

EXPOSE 8080

CMD ["./arcadia-server"]
