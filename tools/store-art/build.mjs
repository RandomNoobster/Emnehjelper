// Renders the Chrome Web Store screenshots (1280x800) and small promo tile (440x280) in the "Klar" style.
// Usage: node build.mjs [--raw=<folder with raw captures>] [--out=<output folder>]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { PNG } from "pngjs";
import {
  REPO, setRawDir, page, abs, logo, panel, card,
  studyPlanWindow, coursePageWindow, popupWindow, withShot, withoutShot,
} from "./lib.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const RAW_DIR = path.resolve(arg("raw", path.join(REPO, "media/raw")));
const OUT_DIR = path.resolve(arg("out", path.join(REPO, "media/store")));

// Full-page captures are 2x captures of a 1280x800 viewport; the panel and popup are element captures
const RAW_FILES = ["study-plan", "study-plan-without", "course-page-light", "panel-light", "panel-dark", "about-popup"];
const missing = RAW_FILES.filter((f) => !fs.existsSync(path.join(RAW_DIR, `${f}.png`)));
if (missing.length) {
  console.error(`Missing captures in ${RAW_DIR}: ${missing.map((f) => f + ".png").join(", ")}`);
  console.error("Run `npm run shots` in tools/store-screenshots/ to capture them.");
  process.exit(1);
}
setRawDir(RAW_DIR);

const SCENES = [
  { file: "screenshot-1-studieplan", eyebrow: "Studieplaner", title: "Se hvilke semestre som blir tunge",
    sub: "Emnehjelper legger til vanskelighetsgrad, arbeidsmengde og snittkarakter for alle emnene i studieplanen din." },
  { file: "screenshot-2-for-og-etter", eyebrow: "Før og etter", title: "Slipp å søke opp emnene ett og ett",
    sub: "Det er tungvint å søke opp mange emner i karakterweb, emnr og karakterer.net. Med Emnehjelper får du informasjonen rett i studieplanen." },
  { file: "screenshot-3-emneside", eyebrow: "Emnesider", title: "Statistikk rett på emnesiden",
    sub: "Se beståttprosent, arbeidsmengde og snittkarakter for emnet. Det er også lenker til emnr, karakterweb og karakterer.net, slik at du slipper å søke det opp." },
  { file: "screenshot-4-mork-modus", eyebrow: "Mørk modus", title: "Fungerer i både lys og mørk modus",
    sub: "Panelet bytter tema automatisk etter innstillingene i nettleseren din." },
  { file: "screenshot-5-kom-i-gang", eyebrow: "Kom i gang", title: "Trykk på ikonet for å komme i gang",
    sub: "Fra menyen kan du åpne en forbedret emneside, utforske en studieplan eller søke etter emner." },
];
const TILE_TAGLINE = "Gjør det enklere å velge emner ved NTNU";

// ---------- "Klar" style ----------
const INK = "#0d0b33";
const SH = "0 30px 80px -10px rgba(13,11,51,.22), 0 0 0 1px rgba(13,11,51,.06)";
const BG = `radial-gradient(900px 500px at 105% -10%, #dfe2ff 0%, transparent 60%),
            radial-gradient(700px 500px at -10% 110%, #ece9ff 0%, transparent 60%), #f6f7fb`;
const CSS = `
body { font-family: 'Plus Jakarta Sans Variable', sans-serif; color:${INK}; }
.eb { display:inline-flex; align-items:center; gap:8px; background:#e6e8ff; color:#1a0fb3; font-weight:700; font-size:14px;
      letter-spacing:.06em; text-transform:uppercase; padding:7px 14px; border-radius:999px; }
.t { font-weight:800; font-size:52px; line-height:1.06; letter-spacing:-.028em; margin:18px 0 0; text-wrap:balance; }
.s { font-size:19px; line-height:1.5; color:#55566f; margin:16px 0 0; font-weight:500; }
.center { text-align:center; } .center .s { margin-left:auto; margin-right:auto; }
`;

const head = (sc, { x, y, w, center = false }) =>
  abs(x, y, `<div class="${center ? "center" : ""}" style="width:${w}px">
    <span class="eb">${logo(18, "border-radius:5px")}${sc.eyebrow}</span>
    <h1 class="t">${sc.title}</h1>
    <p class="s" style="max-width:${center ? 760 : w}px">${sc.sub}</p></div>`);

const LAYOUTS = [
  (sc) => head(sc, { x: 140, y: 52, w: 1000, center: true }) +
    abs(80, 292, studyPlanWindow({ w: 1120, h: 560, style: `box-shadow:${SH}` })),
  (sc) => head(sc, { x: 140, y: 52, w: 1000, center: true }) +
    abs(64, 280, card({ label: "Uten Emnehjelper", inner: withoutShot(0.87), w: 620, style: `box-shadow:${SH};filter:grayscale(1)`, labelStyle: "color:#6b6d80" })) +
    abs(300, 440, card({ label: "Med Emnehjelper", inner: withShot(1.0), w: 910, logoDot: true, style: "box-shadow:0 40px 90px -10px rgba(13,11,51,.3), 0 0 0 1px rgba(13,11,51,.06)", labelStyle: `color:${INK}` })),
  (sc) => head(sc, { x: 72, y: 200, w: 420 }) +
    abs(520, 150, coursePageWindow({ w: 730, h: 760, style: `box-shadow:${SH}` })) +
    abs(878, 64, panel({ zoom: 1.12, style: "box-shadow:0 30px 70px -10px rgba(13,11,51,.35), 0 0 0 1px rgba(13,11,51,.06)" })),
  (sc) => head(sc, { x: 72, y: 230, w: 420 }) +
    abs(540, 64, panel({ zoom: 1.08, style: "box-shadow:0 24px 60px -10px rgba(13,11,51,.25), 0 0 0 1px rgba(13,11,51,.06)" })) +
    abs(880, 124, panel({ dark: true, zoom: 1.08, style: "box-shadow:0 30px 70px -10px rgba(13,11,51,.5)" })),
  (sc) => head(sc, { x: 72, y: 230, w: 400 }) +
    abs(500, 90, popupWindow({ w: 720, h: 760, style: `box-shadow:${SH}`, popupZoom: 1.08 })),
];

const tile = () => ({
  bg: "radial-gradient(360px 260px at 100% 0%, #dcdfff 0%, transparent 65%), #f6f7fb",
  css: CSS,
  body:
    abs(32, 34, logo(64, "border-radius:16px;box-shadow:0 8px 20px rgba(9,0,137,.25)")) +
    abs(32, 118, `<div style="font-weight:800;font-size:44px;letter-spacing:-.04em;line-height:1">Emnehjelper</div>
      <div style="font-size:16px;color:#55566f;font-weight:600;margin-top:10px;width:250px;line-height:1.35">${TILE_TAGLINE}</div>`) +
    abs(296, 30, panel({ zoom: 0.5, style: "box-shadow:0 16px 36px -6px rgba(13,11,51,.3), 0 0 0 1px rgba(13,11,51,.06)" })),
});

// ---------- Rendering ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "store-art-"));
const browser = await chromium.launch();
const tab = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 800 } });

// Render at 2x, downscale to the exact store size, and save as 24-bit PNG (the store rejects alpha)
async function render(html, w, h, name) {
  const htmlPath = path.join(tmp, `${name}.html`);
  fs.writeFileSync(htmlPath, html);
  await tab.setViewportSize({ width: w, height: h });
  await tab.goto("file://" + htmlPath);
  await tab.evaluate(() => document.fonts.ready);
  const shot2x = await tab.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  const dataUrl = await tab.evaluate(async ({ src, w, h }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/png");
  }, { src: "data:image/png;base64," + shot2x.toString("base64"), w, h });
  const rgba = PNG.sync.read(Buffer.from(dataUrl.split(",")[1], "base64"));
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), PNG.sync.write(rgba, { colorType: 2 }));
  console.log(`  ${name}.png (${w}x${h})`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`Writing to ${OUT_DIR}`);
for (const [i, sc] of SCENES.entries()) {
  await render(page({ w: 1280, h: 800, css: CSS, bg: BG, body: LAYOUTS[i](sc) }), 1280, 800, sc.file);
}
const t = tile();
await render(page({ w: 440, h: 280, ...t }), 440, 280, "small-promo-tile-440x280");
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
