#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const sourcePath = path.join(root, "media/arcadia-video/source/storyboard.json");
const capturesDir = path.join(root, "media/arcadia-video/captures");
const scenesDir = path.join(root, "media/arcadia-video/scenes");
const outputDir = path.join(root, "media/arcadia-video/output");
const qaDir = path.join(root, "media/arcadia-video/qa");
const logoPath = path.join(root, "app/public/arcadia-logo.svg");
const runtimeModules =
  process.env.CODEX_RUNTIME_NODE_MODULES ||
  "/Users/deepeshsinghrathore/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";

const requireFromRuntime = createRequire(path.join(runtimeModules, "runtime-require.cjs"));
const sharp = requireFromRuntime("sharp");

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(value, maxChars = 28, maxLines = 3) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function svgText(value, x, y, opts = {}) {
  const lines = Array.isArray(value) ? value : wrap(value, opts.maxChars ?? 28, opts.maxLines ?? 3);
  const size = opts.size ?? 48;
  const lineHeight = opts.lineHeight ?? size * 1.08;
  const anchor = opts.anchor ?? "start";
  const weight = opts.weight ?? 700;
  const color = opts.color ?? "#F5F7FA";
  const family = opts.family ?? "Outfit, Poppins, Inter, Arial, sans-serif";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="${family}" font-weight="${weight}" font-size="${size}">
${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("\n")}
</text>`;
}

async function dataUri(filePath, mime = "image/png") {
  const data = await fs.readFile(filePath);
  return `data:${mime};base64,${data.toString("base64")}`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function baseDefs() {
  return `
  <defs>
    <radialGradient id="glow" cx="72%" cy="18%" r="70%">
      <stop offset="0%" stop-color="#00FFB2" stop-opacity="0.40"/>
      <stop offset="34%" stop-color="#16C784" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#050816" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scrim" x1="0" x2="1">
      <stop offset="0%" stop-color="#050816" stop-opacity="0.98"/>
      <stop offset="54%" stop-color="#050816" stop-opacity="0.70"/>
      <stop offset="100%" stop-color="#050816" stop-opacity="0.96"/>
    </linearGradient>
    <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
      <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#1B2536" stroke-width="1" opacity="0.36"/>
    </pattern>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>`;
}

async function productFrame(scene, captureUri) {
  if (!captureUri) return "";
  const x = scene.mode === "hero" ? 626 : 468;
  const y = scene.mode === "hero" ? 132 : 106;
  const w = scene.mode === "hero" ? 544 : 690;
  const h = Math.round(w * 0.5625);
  return `
    <g filter="url(#softShadow)">
      <rect x="${x - 14}" y="${y - 42}" width="${w + 28}" height="${h + 62}" rx="22" fill="#0A0F1A" stroke="#26364A" stroke-width="1"/>
      <rect x="${x - 14}" y="${y - 42}" width="${w + 28}" height="34" rx="22" fill="#070B13"/>
      <circle cx="${x + 8}" cy="${y - 24}" r="5" fill="#FF4D6D"/>
      <circle cx="${x + 26}" cy="${y - 24}" r="5" fill="#C8A75B"/>
      <circle cx="${x + 44}" cy="${y - 24}" r="5" fill="#00FFB2"/>
      <image href="${captureUri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
    </g>`;
}

function problemVisual() {
  const items = [
    ["NO SKIN", "manager upside without enough downside"],
    ["NO PROOF", "capital moves before verified record"],
    ["NO EXIT", "manual unwinds become a trust assumption"],
  ];
  return `<g>
    ${items.map((item, i) => {
      const y = 252 + i * 96;
      return `<g>
        <rect x="672" y="${y}" width="430" height="62" rx="12" fill="#17171D" stroke="${i === 2 ? "#FF4D6D" : "#2B3446"}"/>
        <text x="700" y="${y + 25}" fill="${i === 2 ? "#FF4D6D" : "#00FFB2"}" font-family="IBM Plex Mono, monospace" font-size="14" font-weight="800">${item[0]}</text>
        <text x="700" y="${y + 47}" fill="#B0B0B0" font-family="Poppins, Arial" font-size="15">${item[1]}</text>
      </g>`;
    }).join("")}
  </g>`;
}

function systemVisual(scene) {
  const labels = scene.id.includes("safety")
    ? ["USDC base", "Pyth NAV", "WSOL unwind"]
    : ["Paper mode", "Junior first loss", "Public record"];
  return `<g>
    ${labels.map((label, i) => {
      const x = 594 + i * 174;
      const active = i === 1;
      return `<g>
        <rect x="${x}" y="300" width="140" height="82" rx="16" fill="${active ? "#0A2A24" : "#111827"}" stroke="${active ? "#00FFB2" : "#2B3446"}"/>
        <text x="${x + 70}" y="336" text-anchor="middle" fill="${active ? "#00FFB2" : "#F5F7FA"}" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="800">${escapeXml(label)}</text>
        <text x="${x + 70}" y="362" text-anchor="middle" fill="#7C7C84" font-family="Poppins, Arial" font-size="12">protocol check</text>
        ${i < 2 ? `<path d="M ${x + 146} 341 H ${x + 168}" stroke="#00FFB2" stroke-width="3"/>` : ""}
      </g>`;
    }).join("")}
  </g>`;
}

async function sceneSvg(scene, index, total, cutName) {
  const logoUri = await dataUri(logoPath, "image/svg+xml");
  const capturePath = scene.capture ? path.join(capturesDir, `${scene.capture}.png`) : null;
  const captureUri = capturePath && await fileExists(capturePath) ? await dataUri(capturePath) : null;
  const titleLines = wrap(scene.title, scene.mode === "product" ? 18 : scene.mode === "hero" ? 20 : 24, 3);
  const captionLines = wrap(scene.caption, scene.mode === "product" ? 30 : 42, 3);
  const frame = await productFrame(scene, captureUri);
  const visual = scene.mode === "problem" ? problemVisual() : scene.mode === "system" ? systemVisual(scene) : frame;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    ${baseDefs()}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#050816"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity="0.55"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>
    <image href="${logoUri}" x="68" y="54" width="42" height="42"/>
    <text x="124" y="79" fill="#F5F7FA" font-family="IBM Plex Mono, monospace" font-size="14" font-weight="800">ARCADIA</text>
    <text x="124" y="99" fill="#00FFB2" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="800">COLOSSEUM DEMO</text>
    <text x="68" y="150" fill="#00FFB2" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="800">${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</text>
    ${svgText(titleLines, 68, 242, { size: scene.mode === "hero" ? 64 : 54, color: "#F5F7FA", maxChars: 20 })}
    ${svgText(captionLines, 72, 430, { size: 23, color: "#B0B0B0", weight: 500, lineHeight: 32, maxChars: 42 })}
    ${visual}
    <rect x="68" y="640" width="1020" height="2" fill="#1B2536"/>
    <rect x="68" y="640" width="${Math.round(1020 * ((index + 1) / total))}" height="2" fill="#00FFB2"/>
    <text x="68" y="670" fill="#7C7C84" font-family="IBM Plex Mono, monospace" font-size="10">${escapeXml(cutName.toUpperCase())} / PROOF-GATED VAULTS ON SOLANA</text>
    <text x="1168" y="670" text-anchor="end" fill="#7C7C84" font-family="IBM Plex Mono, monospace" font-size="10">arcadia.fi</text>
  </svg>`;
}

async function createScenePngs(cutName, scenes) {
  await fs.mkdir(scenesDir, { recursive: true });
  const out = [];
  for (const [index, scene] of scenes.entries()) {
    const svg = await sceneSvg(scene, index, scenes.length, cutName);
    const file = path.join(scenesDir, `${cutName}-${String(index + 1).padStart(2, "0")}-${scene.id}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    out.push({ ...scene, file });
  }
  return out;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error([`${cmd} ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result;
}

async function renderCut(cutName, scenes) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(qaDir, { recursive: true });
  const renderedScenes = await createScenePngs(cutName, scenes);
  const clipDir = path.join(outputDir, `${cutName}-clips`);
  await fs.mkdir(clipDir, { recursive: true });

  const clips = [];
  for (const [index, scene] of renderedScenes.entries()) {
    const clip = path.join(clipDir, `${String(index + 1).padStart(2, "0")}-${scene.id}.mp4`);
    const frames = Math.round(scene.duration * FPS);
    const fadeOutStart = Math.max(scene.duration - 0.35, 0);
    const vf = [
      `zoompan=z='min(zoom+0.00075,1.055)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
      "setsar=1",
      "fade=t=in:st=0:d=0.28",
      `fade=t=out:st=${fadeOutStart}:d=0.28`,
      "format=yuv420p",
    ].join(",");
    run("ffmpeg", ["-y", "-loop", "1", "-i", scene.file, "-vf", vf, "-t", String(scene.duration), "-r", String(FPS), "-an", clip]);
    clips.push(clip);
  }

  const listPath = path.join(clipDir, "concat.txt");
  await fs.writeFile(listPath, clips.map(file => `file '${path.basename(file).replace(/'/g, "'\\''")}'`).join("\n") + "\n", "utf8");
  const outName = cutName === "demo90" ? "arcadia-demo-90s.mp4" : "arcadia-marketing-30s.mp4";
  const outPath = path.join(outputDir, outName);
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  await fs.writeFile(
    path.join(qaDir, `${cutName}-render-manifest.json`),
    `${JSON.stringify({
      cutName,
      outPath: path.relative(root, outPath),
      totalDuration,
      scenes: renderedScenes.map(scene => ({ ...scene, file: path.relative(root, scene.file) })),
    }, null, 2)}\n`,
    "utf8"
  );
  console.log(`Rendered ${cutName}: ${outPath}`);
}

async function main() {
  const target = process.argv[2] || "all";
  const storyboard = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  if (target === "all") {
    await renderCut("demo90", storyboard.cuts.demo90);
    await renderCut("social30", storyboard.cuts.social30);
  } else if (storyboard.cuts[target]) {
    await renderCut(target, storyboard.cuts[target]);
  } else {
    throw new Error(`Unknown video cut "${target}". Use demo90, social30, or all.`);
  }
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
