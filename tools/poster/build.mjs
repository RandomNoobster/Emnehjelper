// Renders the campus posters as print-ready PDFs: A3 for walls and A4 for tables, in the "Klar" style.
// Usage: node build.mjs [--raw=<folder with raw captures>] [--out=<output folder>]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const QR = require("qrcode");
const { decompress } = require("wawoff2");

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const RAW_DIR = path.resolve(arg("raw", path.join(REPO, "media/raw")));
const OUT_DIR = path.resolve(arg("out", path.join(REPO, "media/posters")));
const fileUrl = (p) => pathToFileURL(p).href;

const RAW_FILES = ["study-plan", "panel-light"];
const missing = RAW_FILES.filter((f) => !fs.existsSync(path.join(RAW_DIR, `${f}.png`)));
if (missing.length) {
  console.error(`Missing captures in ${RAW_DIR}: ${missing.map((f) => f + ".png").join(", ")}`);
  console.error("Run `npm run shots` in tools/store-screenshots/ to capture them.");
  process.exit(1);
}

const STORE_URL = "https://chromewebstore.google.com/detail/emnehjelper/ocfgbjjagbojipkdhbloaegpigmkgiaf";
const LOGO = fileUrl(path.join(REPO, "emnehjelper/media/e-h1024.png"));
const RAW = (name) => fileUrl(path.join(RAW_DIR, `${name}.png`));
const PLAN_URL = "ntnu.no/studier/mtdt/studieretninger-og-hovedprofiler";

// ---------- Text ----------
const T = {
  title: "Skal du velge emner?",
  sub: "Emnehjelper viser vanskelighetsgrad, arbeidsmengde og snittkarakter rett i studieplanen din.",
  intro: "Emnehjelper er en nettleser-utvidelse som gjør det enklere å velge emner ved NTNU. Den viser vanskelighetsgrad, arbeidsmengde og snittkarakter rett i studieplanen din og på alle emnesider.",
  planTitle: "Studieplaner",
  plan: "Hvert emne i studieplanen får merker for vanskelighetsgrad, arbeidsmengde og snittkarakter. Da ser du hvilke semestre som blir tunge, og hvilke valgbare emner som gir de beste karakterene og minst arbeid.",
  courseTitle: "Emnesider",
  course: "På emnesiden ser du beståttprosent, arbeidsmengde og snittkarakter. Det er også lenker til emnr, karakterweb og karakterer.net, slik at du slipper å søke det opp.",
  data: "Statistikken er et vektet gjennomsnitt fra emnr og karakterweb.",
  stepsTitle: "Slik kommer du i gang",
  steps: [
    "Søk etter «Emnehjelper» i Chrome Web Store på PC-en, eller skann QR-koden.",
    "Legg utvidelsen til i nettleseren.",
    "Gå til studieplanen din eller en emneside på ntnu.no.",
  ],
  browsers: "Gratis. Fungerer i Chrome, Edge, Opera, Brave og Vivaldi på PC og Mac.",
  scanTitle: "Skann koden for å laste ned",
  scan: "Du kan også søke etter «Emnehjelper» i Chrome Web Store på PC-en din.",
  fig1: "Figur 1: Studieplanen for 3. år datateknologi med Emnehjelper.",
  fig2: "Figur 2: Panelet på emnesiden til TDT4100.",
};

// ---------- Fonts ----------
// Chromium embeds woff2 fonts in PDFs as Type 3 fonts, which some print shops reject.
// TTF files are embedded as normal TrueType fonts, so the woff2 files are converted first.
const FONT_LIST = [
  ["Plus Jakarta Sans", "plus-jakarta-sans", ["500-normal", "500-italic", "800-normal"]],
  ["Inter", "inter", ["400-normal"]],
];
async function fontFaces(dir) {
  const faces = [];
  for (const [family, pkg, variants] of FONT_LIST) {
    for (const v of variants) {
      const [weight, style] = v.split("-");
      const ttf = path.join(dir, `${pkg}-${v}.ttf`);
      const woff2 = fs.readFileSync(require.resolve(`@fontsource/${pkg}/files/${pkg}-latin-${v}.woff2`));
      fs.writeFileSync(ttf, await decompress(woff2));
      faces.push(`@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};src:url('${fileUrl(ttf)}') format('truetype')}`);
    }
  }
  return faces.join("\n");
}

// ---------- Building blocks (all sizes in mm) ----------
const abs = (x, y, inner, extra = "") =>
  `<div style="position:absolute;left:${x}mm;top:${y}mm;${extra}">${inner}</div>`;

const logo = (size, extra = "") =>
  `<img src="${LOGO}" style="width:${size}mm;height:${size}mm;display:block;${extra}">`;

// Vector QR code. The light colour is transparent, so it needs a white card behind it
let qrSvg = "";
const qr = (size) => qrSvg.replace("<svg ", `<svg style="width:${size}mm;height:${size}mm;display:block" `);

// Region of a full-page capture (CSS px of its 1280x800 viewport)
const R = {
  plan: { x: 352, y: 74, w: 890, h: 400 },    // autumn table with heading
  planTop: { x: 352, y: 78, w: 890, h: 226 }, // the first four courses
};

// Browser window designed in CSS px and scaled to a width in mm with zoom, so it stays vector in the PDF
const BROWSER_CSS = `
.bw { border-radius:12px; overflow:hidden; background:#fff; display:flex; flex-direction:column; font-family:'Inter',sans-serif; }
.bw-top { height:40px; background:#eef0f4; display:flex; align-items:center; gap:14px; padding:0 14px; flex-shrink:0; }
.bw-dots { display:flex; gap:7px; } .bw-dots i { width:11px; height:11px; border-radius:50%; background:#cfd3db; display:block; }
.bw-url { flex:1; height:26px; background:#fff; border-radius:13px; display:flex; align-items:center; padding:0 14px; font-size:13px; color:#5f6368; }
.bw-ext { width:26px; height:26px; display:flex; align-items:center; justify-content:center; }
.bw-ext img { width:18px; height:18px; border-radius:4px; }
`;
function browser({ r, widthMm, extra = "" }) {
  const zoom = (widthMm * 96 / 25.4) / r.w;
  return `<div class="bw" style="zoom:${zoom};width:${r.w}px;${extra}">
    <div class="bw-top"><div class="bw-dots"><i></i><i></i><i></i></div>
      <div class="bw-url">${PLAN_URL}</div><div class="bw-ext"><img src="${LOGO}"></div></div>
    <div style="width:${r.w}px;height:${r.h}px;overflow:hidden;position:relative">
      <img src="${RAW("study-plan")}" style="position:absolute;left:${-r.x}px;top:${-r.y}px;width:1280px;height:800px;max-width:none;display:block"></div></div>`;
}

// The panel capture is 320x882 CSS px. cropPx cuts it off below that height (562 = just above "Se mer")
function panel({ width, cropPx, extra = "" }) {
  const k = width / 320;
  return `<div style="width:${width}mm;height:${cropPx * k}mm;overflow:hidden;border-radius:${16 * k}mm;${extra}">
    <img src="${RAW("panel-light")}" style="width:${width}mm;display:block"></div>`;
}

// ---------- "Klar" style ----------
const INK = "#0d0b33", MUTED = "#55566f";
const BG = `radial-gradient(60% 35% at 105% -5%, #dfe2ff 0%, transparent 70%),
            radial-gradient(55% 30% at -10% 105%, #ece9ff 0%, transparent 70%), #f6f7fb`;

// Printers leave a white border of about 3-5 mm. So the sheet is pure white for the outer 5 mm,
// and the background and shadows fade in smoothly from there to `fadeMm` from the edge.
// This layer lies on top of everything, so keep all content more than `fadeMm` from the edge.
const SOLID_MM = 5;
function edgeFade(w, h, fadeMm) {
  const at = (t) => `${SOLID_MM + (fadeMm - SOLID_MM) * t}mm`;
  const stops = `#fff 0, #fff ${at(0)}, rgba(255,255,255,.84) ${at(.25)}, rgba(255,255,255,.5) ${at(.5)}, rgba(255,255,255,.16) ${at(.75)}, rgba(255,255,255,0) ${at(1)}`;
  const layers = ["to right", "to left", "to bottom", "to top"].map((d) => `linear-gradient(${d}, ${stops})`).join(",");
  return abs(0, 0, "", `width:${w}mm;height:${h}mm;background:${layers};z-index:10;pointer-events:none`);
}

// Shadows scale with the sheet: shadow(1) on A3, shadow(.5) on A4
const shadow = (k) => `0 ${6 * k}mm ${16 * k}mm ${-2 * k}mm rgba(13,11,51,.22), 0 0 0 .3mm rgba(13,11,51,.06)`;

const CSS = `
body { font-family:'Plus Jakarta Sans',sans-serif; color:${INK}; }
.word { font-weight:800; letter-spacing:-.035em; line-height:1; }
.t { font-weight:800; line-height:1.02; letter-spacing:-.035em; text-wrap:balance; }
.s { color:${MUTED}; font-weight:500; line-height:1.45; text-wrap:pretty; }
.card { background:#fff; }
.num { display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:#1a0fb3; color:#fff; font-weight:800; flex-shrink:0; }
`;

const header = (logoMm, wordMm, margin) =>
  abs(margin, margin, `<div style="display:flex;align-items:center;gap:${logoMm * 0.3}mm">
      ${logo(logoMm, `border-radius:${logoMm * 0.22}mm`)}<span class="word" style="font-size:${wordMm}mm">Emnehjelper</span></div>`);

// A3 hangs on a wall and is read from a few metres away: big headline, one picture and a large QR code
const A3 = () =>
  header(15, 9.5, 20) +
  abs(20, 52, `<h1 class="t" style="font-size:33mm;width:257mm">${T.title}</h1>`) +
  abs(20, 126, `<p class="s" style="font-size:8.2mm;width:245mm">${T.sub}</p>`) +
  abs(20, 166, browser({ r: R.plan, widthMm: 257, extra: `box-shadow:${shadow(1)}` })) +
  abs(20, 314, `<div class="card" style="box-shadow:${shadow(1)};width:257mm;height:84mm;border-radius:7mm;display:flex;align-items:center;gap:12mm;padding:0 12mm">
      ${qr(60)}
      <div><div class="t" style="font-size:11.5mm;letter-spacing:-.03em">${T.scanTitle}</div>
        <p class="s" style="font-size:5.6mm;margin-top:4mm">${T.scan}</p>
        <p class="s" style="font-size:5.6mm;margin-top:2mm">${T.browsers}</p></div></div>`) +
  edgeFade(297, 420, 17);

// A4 lies on a table and is read up close: it explains more and has install steps
const A4 = () =>
  header(10, 6.4, 16) +
  abs(16, 36, `<h1 class="t" style="font-size:15mm;width:178mm">${T.title}</h1>`) +
  abs(16, 56, `<p class="s" style="font-size:4.4mm;width:176mm">${T.intro}</p>`) +
  abs(16, 82, browser({ r: R.planTop, widthMm: 178, extra: `box-shadow:${shadow(.5)}` })) +
  abs(16, 139, `<p class="s" style="font-size:3.2mm;font-style:italic">${T.fig1}</p>`) +
  abs(16, 154, `<div style="width:116mm">
      <h2 class="t" style="font-size:6mm">${T.planTitle}</h2><p class="s" style="font-size:3.75mm;margin-top:1.5mm">${T.plan}</p>
      <h2 class="t" style="font-size:6mm;margin-top:6mm">${T.courseTitle}</h2><p class="s" style="font-size:3.75mm;margin-top:1.5mm">${T.course}</p>
      <p class="s" style="font-size:3.75mm;margin-top:3mm">${T.data}</p></div>`) +
  abs(144, 147, panel({ width: 50, cropPx: 562, extra: `box-shadow:${shadow(.5)}` })) +
  abs(144, 236.5, `<p class="s" style="font-size:3.2mm;font-style:italic;width:50mm">${T.fig2}</p>`) +
  abs(16, 249, `<div class="card" style="box-shadow:${shadow(.5)};width:178mm;height:34mm;border-radius:5mm;display:flex;align-items:center;gap:6mm;padding:0 5mm 0 4mm">
      ${qr(26)}
      <div style="flex:1"><div class="t" style="font-size:4.6mm">${T.stepsTitle}</div>
        ${T.steps.map((s, i) => `<div style="display:flex;gap:2.2mm;align-items:center;margin-top:1.5mm"><span class="num" style="width:4.4mm;height:4.4mm;font-size:2.6mm">${i + 1}</span><span class="s" style="font-size:3.3mm;line-height:1.3;color:${INK}">${s}</span></div>`).join("")}
        <p class="s" style="font-size:3mm;margin-top:1.8mm">${T.browsers}</p>
      </div></div>`) +
  edgeFade(210, 297, 13);

const POSTERS = [
  { file: "emnehjelper-plakat-A3", w: 297, h: 420, body: A3 },
  { file: "emnehjelper-plakat-A4", w: 210, h: 297, body: A4 },
];

// The html element is painted white, so any sliver outside the body is paper white too
const page = ({ w, h, body }, faces) => `<!doctype html><html lang="no"><head><meta charset="utf-8">
  <style>${faces}
  @page { size:${w}mm ${h}mm; margin:0 }
  *{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact}
  html,body{margin:0;padding:0} html{background:#fff}
  body{width:${w}mm;height:${h}mm;overflow:hidden;background:${BG};position:relative}
  h1,h2,p{margin:0}
  ${BROWSER_CSS}
  ${CSS}
  </style></head><body>${body()}</body></html>`;

// ---------- Rendering ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "poster-"));
const faces = await fontFaces(tmp);
qrSvg = await QR.toString(STORE_URL, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0d0b33", light: "#00000000" } });

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`Writing to ${OUT_DIR}`);
const browserApp = await chromium.launch();
const tab = await browserApp.newPage();
for (const poster of POSTERS) {
  const htmlPath = path.join(tmp, `${poster.file}.html`);
  fs.writeFileSync(htmlPath, page(poster, faces));
  await tab.goto(fileUrl(htmlPath));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForLoadState("networkidle");
  const pdfPath = path.join(OUT_DIR, `${poster.file}.pdf`);
  await tab.pdf({ path: pdfPath, width: `${poster.w}mm`, height: `${poster.h}mm`, printBackground: true, preferCSSPageSize: true });
  console.log(`  ${poster.file}.pdf (${poster.w}x${poster.h} mm)`);
}
await browserApp.close();
fs.rmSync(tmp, { recursive: true, force: true });
