// Building blocks for the Chrome Web Store artwork. Every product image is a real capture
// (see RAW_FILES in build.mjs); this file only frames and crops them.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fileUrl = (p) => pathToFileURL(p).href;

export const LOGO = fileUrl(path.join(REPO, "emnehjelper/media/e-h1024.png"));

const FONTS = ["@fontsource-variable/plus-jakarta-sans/index.css", "@fontsource-variable/inter/index.css"]
  .map((css) => `<link rel="stylesheet" href="${fileUrl(require.resolve(css))}">`)
  .join("");

// Set once by build.mjs: the folder holding the raw captures
let rawDir = "";
export const setRawDir = (dir) => { rawDir = dir; };
const RAW = (name) => fileUrl(path.join(rawDir, `${name}.png`));

export const abs = (x, y, inner, extra = "") =>
  `<div style="position:absolute;left:${x}px;top:${y}px;${extra}">${inner}</div>`;

export const logo = (size, extra = "") =>
  `<img src="${LOGO}" style="width:${size}px;height:${size}px;display:block;${extra}">`;

// Show a region of a full-page capture (CSS px of its 1280x800 viewport) at a given scale
export function shot(name, { x = 0, y = 0, w = 1280, h = 800, scale = 1 } = {}) {
  return `<div style="width:${w * scale}px;height:${h * scale}px;overflow:hidden;position:relative">
    <img src="${RAW(name)}" style="position:absolute;left:${-x * scale}px;top:${-y * scale}px;width:${1280 * scale}px;height:${800 * scale}px;max-width:none;display:block"></div>`;
}

// Regions of interest in the captures
const R = {
  planWith: { x: 352, y: 74, w: 890, h: 400 },    // autumn table, with Emnehjelper
  planWithAll: { x: 352, y: 74, w: 890, h: 726 }, // both semesters
  planWithout: { x: 352, y: 74, w: 690, h: 300 }, // autumn table, plain NTNU page
  pageNoPanel: { x: 0, y: 0, w: 940, h: 800 },    // course page left of the docked panel
};

const BROWSER_CSS = `
.bw { border-radius:14px; overflow:hidden; background:#fff; display:flex; flex-direction:column; font-family:'Inter Variable',sans-serif; }
.bw-top { height:44px; background:#eef0f4; display:flex; align-items:center; gap:14px; padding:0 14px; flex-shrink:0; }
.bw-dots { display:flex; gap:7px; } .bw-dots i { width:11px; height:11px; border-radius:50%; background:#cfd3db; display:block; }
.bw-url { flex:1; height:28px; background:#fff; border-radius:14px; display:flex; align-items:center; gap:8px; padding:0 14px; font-size:13px; color:#5f6368; }
.bw-url svg { width:12px; height:12px; opacity:.6; }
.bw-ext { width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; }
.bw-ext img { width:18px; height:18px; border-radius:4px; }
.bw-ext.on { background:#dfe3ff; box-shadow: inset 0 0 0 1.5px #9aa3ff; }
.bw-body { flex:1; position:relative; overflow:hidden; }
`;

// A generic browser window with the Emnehjelper toolbar icon
function browser({ url, body, w, h, extOn = false, style = "" }) {
  return `<div class="bw" style="width:${w}px;height:${h}px;${style}">
    <div class="bw-top"><div class="bw-dots"><i></i><i></i><i></i></div>
      <div class="bw-url"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>${url}</div>
      <div class="bw-ext ${extOn ? "on" : ""}"><img src="${LOGO}"></div>
    </div>
    <div class="bw-body">${body}</div></div>`;
}

const PLAN_URL = "ntnu.no/studier/mtdt/studieretninger-og-hovedprofiler";

export const studyPlanWindow = ({ w, h, style = "" }) =>
  browser({ url: PLAN_URL, w, h, style,
    body: `<div style="background:#fff;height:100%">${shot("study-plan", { ...R.planWithAll, scale: w / R.planWithAll.w })}</div>` });

export const coursePageWindow = ({ w, h, style = "" }) =>
  browser({ url: "ntnu.no/studier/emner/TDT4100", w, h, style,
    body: shot("course-page-light", { ...R.pageNoPanel, scale: w / R.pageNoPanel.w }) });

// The panel capture is 320x882 CSS px with transparent rounded corners
export const panel = ({ dark = false, zoom = 1, style = "" } = {}) =>
  `<div style="width:${320 * zoom}px;border-radius:${16 * zoom}px;overflow:hidden;${style}">
    <img src="${RAW(dark ? "panel-dark" : "panel-light")}" style="width:${320 * zoom}px;display:block"></div>`;

// Faded study plan behind the toolbar popup
export function popupWindow({ w, h, style = "", popupZoom = 1, popupShadow = "0 18px 50px rgba(9,0,137,.25)" }) {
  const body = `<div style="opacity:.42;filter:saturate(.6)">${shot("study-plan", { ...R.planWithAll })}</div>
    <div style="position:absolute;right:12px;top:4px">
      <div style="width:${320 * popupZoom}px;border-radius:${14 * popupZoom}px;overflow:hidden;box-shadow:${popupShadow}">
        <img src="${RAW("about-popup")}" style="width:${320 * popupZoom}px;display:block"></div></div>`;
  return browser({ url: PLAN_URL, body, w, h, style, extOn: true });
}

export const withoutShot = (scale = 1) => shot("study-plan-without", { ...R.planWithout, scale });
export const withShot = (scale = 1) => shot("study-plan", { ...R.planWith, scale });

// A card with a caption bar, wrapping any inner HTML
export function card({ label, inner, w, style = "", labelStyle = "", logoDot = false }) {
  return `<div style="width:${w}px;background:#fff;border-radius:14px;overflow:hidden;${style}">
    <div style="display:flex;align-items:center;gap:9px;height:42px;padding:0 18px;font:600 14px 'Inter Variable';border-bottom:1px solid #eceef3;${labelStyle}">
      ${logoDot ? logo(20, "border-radius:5px") : `<span style="width:10px;height:10px;border-radius:50%;background:#c9ccd6;display:inline-block"></span>`}${label}
    </div><div style="padding:10px;background:#fff">${inner}</div></div>`;
}

export function page({ w, h, css = "", body, bg }) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}
  <style>
  *{box-sizing:border-box} html,body{margin:0;padding:0}
  body{width:${w}px;height:${h}px;overflow:hidden;background:${bg};-webkit-font-smoothing:antialiased;position:relative}
  ${BROWSER_CSS}
  ${css}
  </style></head><body>${body}</body></html>`;
}
