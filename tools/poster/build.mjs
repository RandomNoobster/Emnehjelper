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
const { PNG } = require("pngjs");

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function arg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
  if (value === "") {
    console.error(`${prefix} needs a folder, for example ${prefix}../../media/raw`);
    process.exit(1);
  }
  return value ?? fallback;
}
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
const LOGO_SRC = path.join(REPO, "emnehjelper/media/e-h1024.png");
const RAW = (name) => fileUrl(path.join(RAW_DIR, `${name}.png`));
const PLAN_URL = "ntnu.no/studier/mtdt/studieretninger-og-hovedprofiler";
const PREVIEW_WIDTH_PX = 1200; // Width of the JPG previews the README shows, since GitHub can't show a PDF inline
const BROWSER_BAR_PX = 40;     // Height of the browser frame's toolbar, in CSS px before zoom
const PANEL_CSS_WIDTH = 320;   // Width of the panel capture in CSS px, whatever the capture scale

// Width and height of a PNG, read from its header
function readPngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}
// The panel's height depends on what it shows, so its shape is read from the capture
const panelSize = readPngSize(path.join(RAW_DIR, "panel-light.png"));
const PANEL_ASPECT = panelSize.height / panelSize.width;

// ---------- Text ----------
const T = {
  title: "Skal du velge emner?",
  sub: "Emnehjelper viser vanskelighetsgrad, arbeidsmengde og snittkarakter rett i studieplanen din.",
  intro: "Emnehjelper er en nettleser-utvidelse som gjør det enklere å velge emner ved NTNU. Den viser vanskelighetsgrad, arbeidsmengde og snittkarakter rett i studieplanen din og på alle emnesider.",
  planTitle: "Studieplaner",
  // &shy; marks where long compound words may be split across lines
  plan: "Hvert emne i studie&shy;planen får merker for vanskelighets&shy;grad, arbeids&shy;mengde og snitt&shy;karakter. Da ser du hvilke semestre som blir tunge, og hvilke valg&shy;bare emner som gir de <strong>beste karakterene</strong> og <strong>minst arbeid</strong>.",
  courseTitle: "Emnesider",
  course: "På emne&shy;siden ser du bestått&shy;prosent, arbeids&shy;mengde og snitt&shy;karakter. Det er også lenker til emnr, karakterweb og karakterer.net, slik at du slipper å søke det opp.",
  data: "Statistikken er et vektet gjennom&shy;snitt fra emnr og karakterweb.",
  stepsTitle: "Slik kommer du i gang",
  steps: [
    "Søk etter «Emnehjelper» i Chrome Web Store på PC-en, eller skann QR-koden.",
    "Legg utvidelsen til i nett&shy;leseren.",
    "Gå til studie&shy;planen din eller en emne&shy;side på ntnu.no.",
  ],
  browsers: "Utvidelsen er gratis og fungerer i Chrome, Edge, Opera, Brave og Vivaldi på PC og Mac.",
  scanTitle: "Skann koden for å laste ned",
  scan: "Du kan også søke etter «Emnehjelper» i Chrome Web Store på PC-en din.",
  planCaption: "Studieplanen for 3. år datateknologi med Emnehjelper.",
  panelCaption: "Panelet på emnesiden til TDT4100.",
};

// ---------- Fonts ----------
// Chromium embeds woff2 fonts in PDFs as Type 3 fonts, which some print shops reject.
// TTF files are embedded as normal TrueType fonts, so the woff2 files are converted first.
const FONT_LIST = [
  ["Plus Jakarta Sans", "plus-jakarta-sans", ["500-normal", "500-italic", "600-normal", "800-normal"]],
  ["Inter", "inter", ["400-normal"]],
];
async function prepareFontFaces(dir) {
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

// ---------- Logo ----------
// The logo PNG has a light rim, 3-4 px wide, around its edge. On a tinted background that rim makes the
// logo look cut out, so the outer pixels are recoloured navy (keeping their transparency) before use.
// The letters are far from the edge, so they are not touched.
function cleanLogo(src, dest, rim = 6) {
  const png = PNG.sync.read(fs.readFileSync(src));
  const { width: w, height: h, data } = png;
  // Distance (in pixels, up to `rim`) from the nearest transparent pixel or image border
  const dist = new Int16Array(w * h).fill(rim + 1);
  const queue = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3] === 0 || x === 0 || y === 0 || x === w - 1 || y === h - 1) { dist[i] = 0; queue.push(i); }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (dist[i] >= rim) continue;
    const x = i % w, y = (i - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      const j = Y * w + X;
      if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; queue.push(j); }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (dist[i] <= rim && data[i * 4 + 3] > 0) { data[i * 4] = 0x09; data[i * 4 + 1] = 0x00; data[i * 4 + 2] = 0x89; }
  }
  fs.writeFileSync(dest, PNG.sync.write(png));
}

// Chromium stamps each PDF with the current time, so every build changed both PDFs even when nothing
// else did. A fixed date keeps rebuilds byte-identical. Only the 14 digits are replaced, so the
// length stays the same and the PDF's byte offsets stay valid.
function stabilizePdf(file) {
  const text = fs.readFileSync(file).toString("latin1");
  const fixed = text.replace(/\/(CreationDate|ModDate) \(D:\d{14}/g, (match, key) => `/${key} (D:20000101000000`);
  fs.writeFileSync(file, Buffer.from(fixed, "latin1"));
}

// ---------- Assets ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "poster-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true })); // also runs when the build fails
const faces = await prepareFontFaces(tmp);
cleanLogo(LOGO_SRC, path.join(tmp, "logo.png"));
const LOGO = fileUrl(path.join(tmp, "logo.png"));
// Vector QR code. The light colour is transparent, so it needs a white card behind it
const QR_SVG = await QR.toString(STORE_URL, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0d0b33", light: "#00000000" } });

// ---------- Building blocks (all sizes in mm) ----------
const abs = (x, y, inner, extra = "") =>
  `<div style="position:absolute;left:${x}mm;top:${y}mm;${extra}">${inner}</div>`;

const logo = (size, extra = "") =>
  `<img src="${LOGO}" style="width:${size}mm;height:${size}mm;display:block;${extra}">`;

const qr = (size) => QR_SVG.replace("<svg ", `<svg style="width:${size}mm;height:${size}mm;display:block" `);

// Region of a full-page capture (CSS px of its 1280x800 viewport)
const R = {
  plan: { x: 352, y: 74, w: 890, h: 400 },    // autumn table with heading
  planTop: { x: 352, y: 78, w: 890, h: 226 }, // the first four courses
};

// Browser window designed in CSS px and scaled to a width in mm with zoom, so it stays vector in the PDF
const BROWSER_CSS = `
.bw { border-radius:12px; overflow:hidden; background:#fff; display:flex; flex-direction:column; font-family:'Inter',sans-serif; }
.bw-top { height:${BROWSER_BAR_PX}px; background:#eef0f4; display:flex; align-items:center; gap:14px; padding:0 14px; flex-shrink:0; }
.bw-dots { display:flex; gap:7px; } .bw-dots i { width:11px; height:11px; border-radius:50%; background:#cfd3db; display:block; }
.bw-url { flex:1; height:26px; background:#fff; border-radius:13px; display:flex; align-items:center; padding:0 14px; font-size:13px; color:#5f6368; }
.bw-ext { width:26px; height:26px; display:flex; align-items:center; justify-content:center; }
.bw-ext img { width:18px; height:18px; }
`;
// Height in mm of a browser frame showing region r at widthMm wide
const browserHeight = (r, widthMm) => (r.h + BROWSER_BAR_PX) * widthMm / r.w;
function browser({ r, widthMm, extra = "" }) {
  const zoom = (widthMm * 96 / 25.4) / r.w;
  // `extra` (the shadow) goes on an unzoomed wrapper, so its mm values are not scaled by the zoom
  return `<div style="width:${widthMm}mm;border-radius:${12 * zoom}px;${extra}"><div class="bw" style="zoom:${zoom};width:${r.w}px">
    <div class="bw-top"><div class="bw-dots"><i></i><i></i><i></i></div>
      <div class="bw-url">${PLAN_URL}</div><div class="bw-ext"><img src="${LOGO}"></div></div>
    <div style="width:${r.w}px;height:${r.h}px;overflow:hidden;position:relative">
      <img src="${RAW("study-plan")}" style="position:absolute;left:${-r.x}px;top:${-r.y}px;width:1280px;height:800px;max-width:none;display:block"></div></div></div>`;
}

// The whole panel capture, which has transparent rounded corners (16 CSS px)
function panel({ width, extra = "" }) {
  const k = width / PANEL_CSS_WIDTH;
  return `<div style="width:${width}mm;height:${width * PANEL_ASPECT}mm;overflow:hidden;border-radius:${16 * k}mm;${extra}">
    <img src="${RAW("panel-light")}" style="width:${width}mm;display:block"></div>`;
}

// ---------- "Klar" style ----------
const INK = "#0d0b33", MUTED = "#55566f";
// Two soft lavender glows. Their centres sit inside the sheet, so they are already faint where the
// white edge fade starts; a glow centred on the corner made that corner look darker than the rest.
// Sizes are for A3 and scale with the sheet width.
const glow = (rgb, cx, cy, rx, ry) =>
  `radial-gradient(${rx}mm ${ry}mm at ${cx}mm ${cy}mm, rgba(${rgb},.5) 0%, rgba(${rgb},0.35) 35%, rgba(${rgb},0.135) 65%, rgba(${rgb},0) 100%)`;
const background = (w, h) => {
  const k = w / 297;
  return `${glow("205,210,255", w - 87 * k, 75 * k, 100 * k, 80 * k)},
    ${glow("222,216,255", 87 * k, h - 75 * k, 100 * k, 80 * k)}, #f6f7fb`;
};

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
.s strong { color:${INK}; font-weight:600; }
.fit { font-size:calc(var(--fs) * 1mm); line-height:1.55; }
.card { background:#fff; }
.num { display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:#1a0fb3; color:#fff; font-weight:800; flex-shrink:0; }
`;

const header = (logoMm, wordMm, margin) =>
  abs(margin, margin, `<div style="display:flex;align-items:center;gap:${logoMm * 0.3}mm">
      ${logo(logoMm)}<span class="word" style="font-size:${wordMm}mm">Emnehjelper</span></div>`);

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

// A4 lies on a table and is read up close: it explains more and has install steps.
// Below the study plan there are two columns that end on the same line: the whole panel on the right,
// and on the left the text with the QR card under it. The text size is picked by fitText() so the
// text exactly fills the space above the card.
const A4_BOTTOM = 283;                 // 14 mm from the edge, just inside the white edge fade
const A4_PLAN_TOP = 78.5, A4_PLAN_W = 178;
// Everything under the study plan follows its bottom edge, so a different crop in R.planTop moves it too
const A4_PLAN_BOTTOM = A4_PLAN_TOP + browserHeight(R.planTop, A4_PLAN_W);
const PLAN_CAPTION_TOP = A4_PLAN_BOTTOM + 3;
const PANEL_TOP = A4_PLAN_BOTTOM + 4.3;
const TEXT_TOP = A4_PLAN_BOTTOM + 12.3;
const CAPTION_H = 3.2 * 1.45, CAPTION_GAP = 2.4;
const PANEL_W = (A4_BOTTOM - CAPTION_H - CAPTION_GAP - PANEL_TOP) / PANEL_ASPECT;
const PANEL_X = 194 - PANEL_W;
const TEXT_W = PANEL_X - 9 - 16;

const A4 = () =>
  header(10, 6.4, 16) +
  abs(16, 36, `<h1 class="t" style="font-size:15mm;width:178mm">${T.title}</h1>`) +
  abs(16, 55, `<p class="s" style="font-size:4.4mm;width:176mm">${T.intro}</p>`) +
  abs(16, A4_PLAN_TOP, browser({ r: R.planTop, widthMm: A4_PLAN_W, extra: `box-shadow:${shadow(.5)}` })) +
  abs(16, PLAN_CAPTION_TOP, `<p class="s" style="font-size:3.2mm;font-style:italic">${T.planCaption}</p>`) +
  abs(16, TEXT_TOP, `<div id="fit-col" data-gap-mm="5" style="width:${TEXT_W}mm;height:${A4_BOTTOM - TEXT_TOP}mm;display:flex;flex-direction:column;justify-content:space-between">
      <div id="fit-text" style="--fs:4.2">
        <h2 class="t" style="font-size:calc(var(--fs) * 1.62mm)">${T.planTitle}</h2>
        <p class="s fit" style="margin-top:2mm">${T.plan}</p>
        <h2 class="t" style="font-size:calc(var(--fs) * 1.62mm);margin-top:calc(var(--fs) * 1.5mm)">${T.courseTitle}</h2>
        <p class="s fit" style="margin-top:2mm">${T.course}</p>
        <p class="s fit" style="margin-top:calc(var(--fs) * .8mm)">${T.data}</p></div>
      <div id="fit-card" class="card" style="box-shadow:${shadow(.5)};border-radius:5mm;display:flex;align-items:center;gap:5mm;padding:4mm 4mm 4mm 4mm">
        ${qr(28)}
        <div style="flex:1;min-width:0"><div class="t" style="font-size:4.6mm">${T.stepsTitle}</div>
          ${T.steps.map((s, i) => `<div style="display:flex;gap:2.2mm;align-items:flex-start;margin-top:1.6mm"><span class="num" style="width:4.4mm;height:4.4mm;font-size:2.6mm">${i + 1}</span><span class="s" style="font-size:3.3mm;line-height:1.33;color:${INK}">${s}</span></div>`).join("")}
          <p class="s" style="font-size:3mm;margin-top:2mm">${T.browsers}</p>
        </div></div></div>`) +
  abs(PANEL_X, PANEL_TOP, panel({ width: PANEL_W, extra: `box-shadow:${shadow(.5)}` })) +
  // The caption is a little wider than the panel, so it is centred under it
  abs(PANEL_X, A4_BOTTOM - CAPTION_H, `<div style="width:${PANEL_W}mm;display:flex;justify-content:center"><p class="s" style="font-size:3.2mm;font-style:italic;white-space:nowrap">${T.panelCaption}</p></div>`) +
  edgeFade(210, 297, 13);

// Runs in the page: the largest text size (in mm) at which the text and the card fit in the column.
// ok is false when even the smallest size is too big, so the build can stop instead of overflowing.
const FIT_SCRIPT = `<script>
window.fitText = () => {
  const col = document.getElementById("fit-col");
  if (!col) return null;
  const text = document.getElementById("fit-text"), card = document.getElementById("fit-card");
  const gap = parseFloat(col.dataset.gapMm) * 96 / 25.4;
  const fits = (fs) => { text.style.setProperty("--fs", fs); return text.offsetHeight + gap + card.offsetHeight <= col.clientHeight; };
  let lo = 3.4, hi = 5.4;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  return { size: lo, ok: fits(lo) };
};
</script>`;

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
  body{width:${w}mm;height:${h}mm;overflow:hidden;background:${background(w, h)};position:relative}
  h1,h2,p{margin:0}
  ${BROWSER_CSS}
  ${CSS}
  </style>${FIT_SCRIPT}</head><body>${body()}</body></html>`;

// ---------- Rendering ----------
fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`Writing to ${OUT_DIR}`);
const browserApp = await chromium.launch();
try {
  for (const poster of POSTERS) {
    const htmlPath = path.join(tmp, `${poster.file}.html`);
    fs.writeFileSync(htmlPath, page(poster, faces));
    const cssW = poster.w * 96 / 25.4, cssH = poster.h * 96 / 25.4;
    const tab = await browserApp.newPage({
      viewport: { width: Math.ceil(cssW), height: Math.ceil(cssH) },
      deviceScaleFactor: PREVIEW_WIDTH_PX / cssW,
    });
    await tab.goto(fileUrl(htmlPath)); // waits for the load event, so the images are in
    await tab.evaluate(() => document.fonts.ready);
    const fit = await tab.evaluate(() => window.fitText());
    if (fit && !fit.ok) {
      throw new Error(`${poster.file}: the text beside the panel doesn't fit above the QR card even at ${fit.size.toFixed(1)} mm. Shorten the text in T.`);
    }
    const pdfPath = path.join(OUT_DIR, `${poster.file}.pdf`);
    await tab.pdf({ path: pdfPath, width: `${poster.w}mm`, height: `${poster.h}mm`, printBackground: true, preferCSSPageSize: true });
    stabilizePdf(pdfPath);
    await tab.screenshot({ path: path.join(OUT_DIR, `${poster.file}.jpg`), type: "jpeg", quality: 85, clip: { x: 0, y: 0, width: cssW, height: cssH } });
    await tab.close();
    console.log(`  ${poster.file}.pdf and .jpg (${poster.w}x${poster.h} mm)${fit ? `, text size ${fit.size.toFixed(2)} mm` : ""}`);
  }
} finally {
  await browserApp.close();
}
