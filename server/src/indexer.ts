import type { FastifyBaseLogger } from "fastify";

const updatedAt = new Date().toISOString();

export function getHealthSnapshot() {
  return {
    status: "deferred",
    backend: "server-rs",
    message: "The canonical Kiln indexer/API is server-rs. This Node server is retained only as a compatibility shim.",
    updatedAt,
  };
}

export function listVaults() {
  return [];
}

export function getVaultByAddress(_configAddress: string) {
  return null;
}

export function getManagerByAddress(_address: string) {
  return null;
}

export async function startIndexer(log: FastifyBaseLogger) {
  log.warn("Node indexer is deferred; run server-rs for materialized Kiln API reads.");
}
