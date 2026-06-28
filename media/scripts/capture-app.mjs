#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outputDir = path.join(root, "media/arcadia-video/captures");
const qaDir = path.join(root, "media/arcadia-video/qa");
const defaultBaseUrl = process.env.ARCADIA_CAPTURE_URL || "http://127.0.0.1:8080";
const runtimeModules =
  process.env.CODEX_RUNTIME_NODE_MODULES ||
  "/Users/deepeshsinghrathore/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";

const requireFromRuntime = createRequire(path.join(runtimeModules, "runtime-require.cjs"));
const { chromium } = requireFromRuntime("playwright");

const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

const routes = [
  { key: "landing", path: "/", role: "investor" },
  { key: "marketplace", path: "/vaults", role: "investor" },
  { key: "vault-detail", path: "/vault/vlt-001", role: "investor" },
  { key: "portfolio", path: "/portfolio", role: "investor" },
  { key: "manager-dashboard", path: "/manager", role: "trader" },
  { key: "manager-vault", path: "/manager/vault/vlt-001", role: "trader" },
  { key: "trade-terminal", path: "/trade", role: "trader" },
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findChrome() {
  for (const candidate of chromeCandidates) {
    if (await exists(candidate)) return candidate;
  }
  return undefined;
}

async function isReachable(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(2500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 70000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isReachable(url)) return true;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

async function ensureServer(baseUrl) {
  if (await isReachable(baseUrl)) return { child: null, started: false };

  const child = spawn("pnpm", ["--dir", "app", "dev", "--host", "127.0.0.1", "--port", "8080"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });

  child.stdout.on("data", chunk => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on("data", chunk => process.stderr.write(`[vite] ${chunk}`));

  const ready = await waitForServer(baseUrl);
  if (!ready) {
    child.kill("SIGTERM");
    throw new Error(`Could not start or reach app at ${baseUrl}`);
  }

  return { child, started: true };
}

function routeUrl(baseUrl, routePath) {
  return new URL(routePath, baseUrl).toString();
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(qaDir, { recursive: true });

  const server = await ensureServer(defaultBaseUrl);
  const executablePath = await findChrome();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });

  const report = {
    baseUrl: defaultBaseUrl,
    capturedAt: new Date().toISOString(),
    startedServer: server.started,
    routes: [],
    errors: [],
  };

  for (const route of routes) {
    const page = await context.newPage();
    const consoleMessages = [];
    const pageErrors = [];

    page.on("console", msg => {
      const item = { type: msg.type(), text: msg.text() };
      consoleMessages.push(item);
      if (msg.type() === "error") report.errors.push({ route: route.key, ...item });
    });
    page.on("pageerror", error => {
      const item = { type: "pageerror", text: error.message };
      pageErrors.push(item);
      report.errors.push({ route: route.key, ...item });
    });

    await page.goto(defaultBaseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(role => {
      localStorage.setItem("kiln.wallet.prefs", JSON.stringify({ role, network: "devnet" }));
      localStorage.setItem("kiln:data-mode", "mock");
    }, route.role);

    await page.goto(routeUrl(defaultBaseUrl, route.path), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2600);

    const filePath = path.join(outputDir, `${route.key}.png`);
    await page.screenshot({ path: filePath, fullPage: false });

    report.routes.push({
      key: route.key,
      path: route.path,
      role: route.role,
      screenshot: path.relative(root, filePath),
      consoleMessages,
      pageErrors,
    });
    await page.close();
  }

  await browser.close();
  if (server.child) server.child.kill("SIGTERM");

  const reportPath = path.join(qaDir, "capture-console-report.json");
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Captured ${routes.length} Arcadia screens to ${outputDir}`);
  console.log(`Console report: ${reportPath}`);
  if (report.errors.length) {
    console.warn(`Capture completed with ${report.errors.length} console/page errors. See report for details.`);
  }
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
