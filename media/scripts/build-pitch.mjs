#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const deckDir = path.join(root, "media/arcadia-pitch");
const sourcePath = path.join(deckDir, "source/slides.json");
const previewDir = path.join(deckDir, "preview");
const outputDir = path.join(deckDir, "output");
const workspaceDir = path.join(deckDir, ".artifact-workspace");
const logoPath = path.join(root, "app/public/arcadia-logo.svg");
const capturesDir = path.join(root, "media/arcadia-video/captures");
const runtimeModules =
  process.env.CODEX_RUNTIME_NODE_MODULES ||
  "/Users/deepeshsinghrathore/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const presentationsSkillDir =
  process.env.PRESENTATIONS_SKILL_DIR ||
  "/Users/deepeshsinghrathore/.codex/plugins/cache/openai-primary-runtime/presentations/26.430.10722/skills/presentations";

const requireFromRuntime = createRequire(path.join(runtimeModules, "runtime-require.cjs"));
const { PDFDocument } = requireFromRuntime("pdf-lib");
const sharp = requireFromRuntime("sharp");

let createSlideContext;
let ensureArtifactToolWorkspace;
let importArtifactTool;
let saveBlobToFile;

async function loadArtifactToolUtils() {
  const utilsPath = path.join(presentationsSkillDir, "scripts/artifact_tool_utils.mjs");
  const utils = await import(pathToFileURL(utilsPath).href);
  createSlideContext = utils.createSlideContext;
  ensureArtifactToolWorkspace = utils.ensureArtifactToolWorkspace;
  importArtifactTool = utils.importArtifactTool;
  saveBlobToFile = utils.saveBlobToFile;
}

const SLIDE_SIZE = { width: 1280, height: 720 };
const C = {
  bg: "#050816",
  bg2: "#0B1120",
  surface: "#111827",
  surface2: "#17171D",
  border: "#2B3446",
  signal: "#00FFB2",
  signalDeep: "#16C784",
  text: "#F5F7FA",
  muted: "#B0B0B0",
  dim: "#7C7C84",
  danger: "#FF4D6D",
  warning: "#C8A75B",
};

function text(slide, ctx, value, left, top, width, height, opts = {}) {
  return ctx.addText(slide, {
    text: String(value ?? ""),
    left,
    top,
    width,
    height,
    fontSize: opts.size ?? 18,
    color: opts.color ?? C.text,
    bold: Boolean(opts.bold),
    typeface: opts.face ?? opts.typeface ?? "Aptos",
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    fill: opts.fill ?? "#00000000",
    line: opts.line ?? ctx.line(),
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
    name: opts.name,
  });
}

function rect(slide, ctx, left, top, width, height, fill, opts = {}) {
  return ctx.addShape(slide, {
    left,
    top,
    width,
    height,
    geometry: opts.geometry ?? "rect",
    fill,
    line: opts.line ?? ctx.line(),
    name: opts.name,
  });
}

function rule(slide, ctx, left, top, width, color = C.signal, height = 2) {
  rect(slide, ctx, left, top, width, height, color);
}

function wrap(value, maxChars = 56, maxLines = 4) {
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
  return lines.join("\n");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function addLogo(slide, ctx, left = 62, top = 48, size = 48) {
  if (await fileExists(logoPath)) {
    await ctx.addImage(slide, { path: logoPath, left, top, width: size, height: size, fit: "contain", alt: "Arcadia logo" });
  } else {
    rect(slide, ctx, left, top, size, size, C.signalDeep);
  }
}

function addFooter(slide, ctx, page) {
  rule(slide, ctx, 62, 654, 1156, "#1E293B", 1);
  text(slide, ctx, "ARCADIA / COLOSSEUM PITCH", 62, 668, 360, 16, { size: 9, color: C.dim, bold: true, face: "Aptos Mono" });
  text(slide, ctx, String(page).padStart(2, "0"), 1160, 668, 58, 16, { size: 9, color: C.dim, bold: true, face: "Aptos Mono", align: "right" });
}

function addGrid(slide, ctx) {
  rect(slide, ctx, 0, 0, 1280, 720, C.bg);
  rect(slide, ctx, 0, 0, 1280, 720, "#07111F");
  for (let x = 0; x <= 1280; x += 80) rect(slide, ctx, x, 0, 1, 720, "#0F1A29");
  for (let y = 0; y <= 720; y += 80) rect(slide, ctx, 0, y, 1280, 1, "#0F1A29");
  rect(slide, ctx, 814, 80, 360, 360, "#062A24", { geometry: "ellipse" });
  rect(slide, ctx, 996, 500, 240, 160, "#0A241F", { geometry: "ellipse" });
}

async function addCapture(slide, ctx, key, left, top, width, height) {
  const capturePath = path.join(capturesDir, `${key}.png`);
  if (!(await fileExists(capturePath))) return false;
  rect(slide, ctx, left - 10, top - 34, width + 20, height + 52, C.surface2, { line: ctx.line("#223044", 1) });
  rect(slide, ctx, left - 10, top - 34, width + 20, 28, "#0A0F1A");
  rect(slide, ctx, left + 4, top - 24, 8, 8, C.danger, { geometry: "ellipse" });
  rect(slide, ctx, left + 20, top - 24, 8, 8, C.warning, { geometry: "ellipse" });
  rect(slide, ctx, left + 36, top - 24, 8, 8, C.signal, { geometry: "ellipse" });
  await ctx.addImage(slide, { path: capturePath, left, top, width, height, fit: "cover", alt: `${key} app capture` });
  return true;
}

function addBullets(slide, ctx, bullets, x, y, w) {
  bullets.forEach((bullet, index) => {
    const top = y + index * 54;
    text(slide, ctx, `0${index + 1}`, x, top + 3, 38, 20, { size: 11, color: C.signal, bold: true, face: "Aptos Mono" });
    text(slide, ctx, bullet, x + 52, top, w - 52, 34, { size: 18, color: C.text, bold: true });
    rule(slide, ctx, x + 52, top + 42, Math.min(310, w - 70), "#223044", 1);
  });
}

async function slideCover(presentation, ctx, slideData, index) {
  const slide = presentation.slides.add();
  addGrid(slide, ctx);
  await addLogo(slide, ctx, 62, 54, 54);
  text(slide, ctx, "ARCADIA", 130, 58, 180, 26, { size: 15, color: C.text, bold: true, face: "Aptos Mono" });
  text(slide, ctx, "COLOSSEUM / SOLANA", 130, 86, 230, 16, { size: 9, color: C.signal, bold: true, face: "Aptos Mono" });
  text(slide, ctx, "Capital\nfollows proof.", 62, 188, 620, 190, { size: 64, color: C.text, bold: true, face: "Aptos Display" });
  text(slide, ctx, wrap(slideData.claim, 50, 4), 68, 406, 560, 92, { size: 22, color: C.muted, face: "Aptos" });
  await addCapture(slide, ctx, "landing", 702, 170, 448, 252);
  rect(slide, ctx, 720, 470, 360, 74, "#0B1B20", { line: ctx.line("#1D4B42", 1) });
  text(slide, ctx, "Proof-gated vaults on Solana", 744, 492, 308, 26, { size: 22, color: C.signal, bold: true });
  text(slide, ctx, "Paper mode · first loss · public records", 744, 522, 308, 18, { size: 11, color: C.muted, face: "Aptos Mono" });
  addFooter(slide, ctx, index);
  return slide;
}

async function slideStandard(presentation, ctx, slideData, index) {
  const slide = presentation.slides.add();
  addGrid(slide, ctx);
  await addLogo(slide, ctx, 62, 48, 38);
  text(slide, ctx, slideData.eyebrow.toUpperCase(), 112, 58, 240, 16, { size: 9, color: C.signal, bold: true, face: "Aptos Mono" });
  text(slide, ctx, wrap(slideData.title, 29, 3), 62, 112, 660, 132, { size: 38, color: C.text, bold: true, face: "Aptos Display" });
  text(slide, ctx, wrap(slideData.claim, 60, 4), 66, 244, 590, 104, { size: 20, color: C.muted });
  addBullets(slide, ctx, slideData.bullets, 72, 388, 560);
  rect(slide, ctx, 716, 118, 442, 360, C.surface, { line: ctx.line("#223044", 1) });
  text(slide, ctx, "PROOF OBJECT", 744, 148, 160, 16, { size: 9, color: C.signal, bold: true, face: "Aptos Mono" });
  text(slide, ctx, wrap(slideData.proof, 36, 5), 744, 186, 354, 130, { size: 24, color: C.text, bold: true, face: "Aptos Display" });
  drawSlideVisual(slide, ctx, index);
  addFooter(slide, ctx, index);
  return slide;
}

function drawSlideVisual(slide, ctx, index) {
  const x = 752;
  const y = 380;
  if (index === 2) {
    ["NO SKIN", "NO PROOF", "NO EXIT"].forEach((label, i) => {
      rect(slide, ctx, x + i * 122, y, 104, 42, "#1C1620", { line: ctx.line(C.danger, 1) });
      text(slide, ctx, label, x + i * 122, y + 13, 104, 14, { size: 10, color: C.danger, bold: true, face: "Aptos Mono", align: "center" });
    });
    return;
  }
  if (index === 5 || index === 7) {
    const nodes = index === 5 ? ["PAPER", "JUNIOR", "SENIOR"] : ["USDC", "PYTH NAV", "UNWIND"];
    nodes.forEach((label, i) => {
      rect(slide, ctx, x + i * 112, y, 92, 52, i === 1 ? "#0D2B25" : C.surface2, { line: ctx.line(i === 1 ? C.signal : "#27364A", 1) });
      text(slide, ctx, label, x + i * 112, y + 18, 92, 14, { size: 10, color: i === 1 ? C.signal : C.text, bold: true, face: "Aptos Mono", align: "center" });
      if (i < 2) rule(slide, ctx, x + i * 112 + 94, y + 26, 18, C.signal, 2);
    });
    return;
  }
  const values = ["VAULT", "BUFFER", "LIMIT", "EXIT"];
  values.forEach((label, i) => {
    const h = 32 + i * 22;
    rect(slide, ctx, x + i * 80, y + 94 - h, 46, h, i === 0 ? C.signal : i === 1 ? C.signalDeep : i === 2 ? C.warning : C.danger);
    text(slide, ctx, label, x + i * 80 - 8, y + 108, 64, 14, { size: 8, color: C.muted, bold: true, face: "Aptos Mono", align: "center" });
  });
}

async function writePdfFromPreviews(previewPaths, outPath) {
  const pdfDoc = await PDFDocument.create();
  for (const previewPath of previewPaths) {
    const png = await fs.readFile(previewPath);
    const image = await pdfDoc.embedPng(png);
    const page = pdfDoc.addPage([1280, 720]);
    page.drawImage(image, { x: 0, y: 0, width: 1280, height: 720 });
  }
  const bytes = await pdfDoc.save();
  await fs.writeFile(outPath, bytes);
}

async function writeContactSheet(previewPaths, outPath) {
  const thumbs = await Promise.all(
    previewPaths.map(p => sharp(p).resize({ width: 320, height: 180, fit: "cover" }).png().toBuffer())
  );
  const columns = 5;
  const rows = Math.ceil(thumbs.length / columns);
  const composites = thumbs.map((input, i) => ({
    input,
    left: (i % columns) * 320,
    top: Math.floor(i / columns) * 180,
  }));
  await sharp({
    create: {
      width: columns * 320,
      height: rows * 180,
      channels: 4,
      background: C.bg,
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
}

async function main() {
  await loadArtifactToolUtils();
  const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });
  await ensureArtifactToolWorkspace(workspaceDir);
  const artifact = await importArtifactTool(workspaceDir);
  const { Presentation, PresentationFile } = artifact;
  const presentation = Presentation.create({ slideSize: SLIDE_SIZE });

  const previewPaths = [];
  for (const [i, slideData] of source.slides.entries()) {
    const ctx = createSlideContext(artifact, {
      slideSize: SLIDE_SIZE,
      slideNumber: i + 1,
      outputDir,
      assetDir: path.join(deckDir, "assets"),
      workspaceDir,
      titleFont: "Aptos Display",
      bodyFont: "Aptos",
    });
    const slide = i === 0
      ? await slideCover(presentation, ctx, slideData, i + 1)
      : await slideStandard(presentation, ctx, slideData, i + 1);
    const preview = await presentation.export({ slide, format: "png", scale: 1 });
    const previewPath = path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await saveBlobToFile(preview, previewPath);
    previewPaths.push(previewPath);
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(outputDir, "arcadia-colosseum-pitch.pptx");
  await pptx.save(pptxPath);
  await writePdfFromPreviews(previewPaths, path.join(outputDir, "arcadia-colosseum-pitch.pdf"));
  await writeContactSheet(previewPaths, path.join(outputDir, "arcadia-colosseum-pitch-contact-sheet.png"));

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify({
      pptx: path.relative(root, pptxPath),
      pdf: path.relative(root, path.join(outputDir, "arcadia-colosseum-pitch.pdf")),
      slideCount: source.slides.length,
      previewPaths: previewPaths.map(p => path.relative(root, p)),
    }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Built Arcadia pitch deck: ${pptxPath}`);
  console.log(`Built PDF and previews in: ${outputDir}`);
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
