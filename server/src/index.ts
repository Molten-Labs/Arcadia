import Fastify from "fastify";
import cors from "@fastify/cors";

import { SERVER_PORT } from "./config.js";
import {
  getHealthSnapshot,
  getManagerByAddress,
  getVaultByAddress,
  listVaults,
  startIndexer,
} from "./indexer.js";
import { getJupiterQuote, getJupiterSwapInstructions } from "./jupiter.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => getHealthSnapshot());
app.get("/vaults", async () => ({ items: listVaults() }));
app.get("/vaults/:configAddress", async (request, reply) => {
  const { configAddress } = request.params as { configAddress: string };
  const vault = getVaultByAddress(configAddress);
  if (!vault) {
    reply.code(404);
    return { error: "Vault not found" };
  }
  return vault;
});

app.get("/managers/:address", async (request, reply) => {
  const { address } = request.params as { address: string };
  const manager = getManagerByAddress(address);
  if (!manager) {
    reply.code(404);
    return { error: "Manager not found" };
  }
  return manager;
});

app.get("/jupiter/quote", async (request, reply) => {
  const result = await getJupiterQuote(request.query);
  reply.code(result.status);
  return result.body;
});

app.post("/jupiter/swap-instructions", async (request, reply) => {
  const result = await getJupiterSwapInstructions(request.body);
  reply.code(result.status);
  return result.body;
});

await startIndexer(app.log);
await app.listen({ port: SERVER_PORT, host: "0.0.0.0" });
