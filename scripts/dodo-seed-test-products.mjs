#!/usr/bin/env node

import fs from "node:fs";

const rootEnvFiles = [".env", ".env.local"];

function loadEnv() {
  const env = { ...process.env };
  for (const file of rootEnvFiles) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
  }
  return env;
}

const env = loadEnv();
const apiKey = env.DODO_PAYMENTS_API_KEY;
const baseUrl = (env.DODO_PAYMENTS_API_BASE_URL || "https://test.dodopayments.com").replace(
  /\/$/,
  "",
);

if (!apiKey) {
  console.error("DODO_PAYMENTS_API_KEY is missing. Add it to .env and rerun.");
  process.exit(1);
}

const products = [
  {
    envVar: "DODO_PRODUCT_BOT_ACCESS_MONTHLY",
    plan: "bot_access_monthly",
    name: "Arcadia Bot Access Monthly",
    description:
      "Monthly access to one private Arcadia trading bot's guarded signals.",
    price: {
      type: "recurring_price",
      currency: "USD",
      discount: 0,
      price: 2900,
      purchasing_power_parity: false,
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 1,
      subscription_period_interval: "Month",
      tax_inclusive: false,
      trial_period_days: 0,
    },
  },
  {
    envVar: "DODO_PRODUCT_CREATOR_PRO_MONTHLY",
    plan: "creator_pro_monthly",
    name: "Arcadia Creator Pro Monthly",
    description: "Monthly creator access to publish and monetize private trading bots.",
    price: {
      type: "recurring_price",
      currency: "USD",
      discount: 0,
      price: 4900,
      purchasing_power_parity: false,
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 1,
      subscription_period_interval: "Month",
      tax_inclusive: false,
      trial_period_days: 0,
    },
  },
  {
    envVar: "DODO_PRODUCT_BOT_CREDITS",
    plan: "bot_credits",
    name: "Arcadia Bot Credits",
    description: "One-time Arcadia bot signal or compute credits.",
    price: {
      type: "one_time_price",
      currency: "USD",
      discount: 0,
      price: 1000,
      purchasing_power_parity: false,
      tax_inclusive: false,
    },
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const detail = typeof body?.raw === "string" ? body.raw : JSON.stringify(body);
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${detail}`);
  }
  return body;
}

async function listProducts() {
  const first = await request("/products?page_size=100&page_number=0");
  return Array.isArray(first?.items) ? first.items : [];
}

function findExistingProduct(items, spec) {
  return items.find(
    (item) =>
      item?.metadata?.arcadia_plan === spec.plan ||
      item?.name === spec.name,
  );
}

async function createProduct(spec) {
  return request("/products", {
    method: "POST",
    body: JSON.stringify({
      name: spec.name,
      description: spec.description,
      tax_category: "saas",
      price: spec.price,
      metadata: {
        arcadia_plan: spec.plan,
        arcadia_project: "arcadia_private_trading_bots",
        arcadia_mode: "test",
      },
    }),
  });
}

const existing = await listProducts();
const results = [];

for (const spec of products) {
  let product = findExistingProduct(existing, spec);
  let action = "reused";
  if (!product) {
    product = await createProduct(spec);
    action = "created";
    existing.push(product);
  }
  results.push({
    envVar: spec.envVar,
    name: spec.name,
    productId: product.product_id,
    action,
  });
}

console.log("Dodo test products:");
for (const result of results) {
  console.log(`${result.action.padEnd(7)} ${result.name}: ${result.productId}`);
}

console.log("\nAdd these to .env:");
for (const result of results) {
  console.log(`${result.envVar}=${result.productId}`);
}
