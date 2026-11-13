// Captures raw Chrome Web Store screenshots of Emnehjelper on live NTNU pages.
// Read README.md in this folder first: it explains each step and the workarounds below.
//
// Usage: node capture.mjs [--ext <dir>] [--out <dir>] [step ...]
// Steps (all of them, in this order, when none are given):
//   study, study-without, course-light, course-dark, course-dark-page-light, about
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- Constants ----------

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(TOOL_DIR, '..', '..');
const CACHE_DIR = path.join(TOOL_DIR, '.cache');
const STUDY_PLAN_PICK_FILE = path.join(CACHE_DIR, 'study-plan-pick.json');

const STUDY_PLAN_URL = 'https://www.ntnu.no/studier/mtdt/studieretninger-og-hovedprofiler#year=2024&programmeCode=MTDT';
const STUDY_DIRECTION = 'MTDTPS-24'; // Programvaresystemer, in the 3rd-year direction dropdown
const THIRD_YEAR_INDEX = 2; // Index of the 3rd year among the study plan's div.year blocks
const COURSE_URL = 'https://www.ntnu.no/studier/emner/TDT4100';

const VIEWPORT = { width: 1280, height: 800 };
const DEVICE_SCALE_FACTOR = 2;
const ABOUT_POPUP_WIDTH = 320;
const HEADING_GAP_PX = 20; // Space between NTNU's sticky header and the semester heading
const DATA_TIMEOUT_MS = 180_000;

const FORCE_DARK_ARGS = ['--force-dark-mode', '--enable-features=WebContentsForceDark'];

const STEPS = {
  'study': captureStudyPlan,
  'study-without': captureStudyPlanWithout,
  'course-light': () => captureCoursePage({ colorScheme: 'light', pageFile: 'course-page-light.png', panelFile: 'panel-light.png' }),
  'course-dark': () => captureCoursePage({ colorScheme: 'dark', forceDark: true, pageFile: 'course-page-dark.png' }),
  'course-dark-page-light': () => captureCoursePage({ colorScheme: 'dark', pageFile: 'course-page-dark-page-light.png', panelFile: 'panel-dark.png' }),
  'about': captureAboutPopup,
};

// ---------- Arguments ----------

function parseArgs(argv) {
  const options = { ext: path.join(REPO_DIR, 'emnehjelper'), out: path.join(REPO_DIR, 'media', 'raw'), steps: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ext') options.ext = path.resolve(argv[++i]);
    else if (argv[i] === '--out') options.out = path.resolve(argv[++i]);
    else options.steps.push(argv[i]);
  }
  if (!options.steps.length) options.steps = Object.keys(STEPS);
  const unknown = options.steps.filter((step) => !STEPS[step]);
  if (unknown.length) {
    throw new Error(`Unknown step(s): ${unknown.join(', ')}. Known steps: ${Object.keys(STEPS).join(', ')}`);
  }
  return options;
}

const OPTIONS = parseArgs(process.argv.slice(2));

// ---------- Helpers ----------

function log(...parts) {
  console.log(new Date().toISOString().slice(11, 19), ...parts);
}

function warn(message) {
  console.warn(`WARNING: ${message}`);
}

function outputPath(file) {
  return path.join(OPTIONS.out, file);
}

// One persistent profile per browser setup, so course data stays cached between runs
async function launchWithExtension({ profileName, colorScheme = 'light', extraArgs = [] }) {
  const context = await chromium.launchPersistentContext(path.join(CACHE_DIR, `profile-${profileName}`), {
    channel: 'chromium', // Full Chromium in new headless mode; the default headless shell cannot load extensions
    headless: true,
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme,
    args: [`--disable-extensions-except=${OPTIONS.ext}`, `--load-extension=${OPTIONS.ext}`, ...extraArgs],
  });
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(serviceWorker.url()).host;
  return { context, serviceWorker, extensionId };
}

// Fonts, images and layout have finished before a capture
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images]
    .filter((image) => !image.complete)
    .map((image) => new Promise((resolve) => { image.onload = image.onerror = resolve; }))));
  await page.waitForTimeout(800);
}

// ---------- Study plan ----------

// The 3rd-year tables only show after a study direction is picked, and then only a few rows behind "vis mer"
async function openThirdYear(page) {
  await page.goto(STUDY_PLAN_URL, { waitUntil: 'networkidle' });
  const thirdYear = page.locator('div.year').nth(THIRD_YEAR_INDEX);
  const directionSelect = thirdYear.locator('select').first();
  await directionSelect.waitFor();
  await directionSelect.selectOption(STUDY_DIRECTION);
  await page.waitForTimeout(1500);

  const showMore = thirdYear.getByText('vis mer', { exact: true });
  for (let i = 0; i < await showMore.count(); i++) {
    const button = showMore.nth(i);
    if (await button.isVisible()) {
      await button.click();
      await page.waitForTimeout(600);
    }
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
}

// Every course row has its cells, pills and link states filled in
async function waitForStudyPlanData(page) {
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('tr.course, tr.courserow')];
    if (!rows.length || rows.some((row) => !row.classList.contains('emnehjelper-processed'))) return false;
    if (document.querySelector('.emnehjelper-loading, .emnehjelper-link-loading')) return false;
    return rows.every((row) => row.querySelectorAll('.emnehjelper-pill').length >= 3
      || row.querySelector('.emnehjelper-cell')?.textContent.trim() === '—');
  }, null, { timeout: DATA_TIMEOUT_MS, polling: 500 });
}

// Bottom edge of NTNU's sticky header, so headings are not scrolled underneath it
async function measureStickyHeaderBottom(page) {
  return page.evaluate(() => {
    let bottom = 0;
    for (const element of document.querySelectorAll('body *')) {
      const { position } = getComputedStyle(element);
      if (position !== 'fixed' && position !== 'sticky') continue;
      const rect = element.getBoundingClientRect();
      if (rect.top <= 1 && rect.height > 0 && rect.height < 200 && rect.width > innerWidth / 2) {
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    return bottom;
  });
}

// Badge colours and size of each visible 3rd-year semester table
async function describeThirdYearTables(page) {
  return page.evaluate((yearIndex) => {
    const thirdYear = document.querySelectorAll('div.year')[yearIndex];
    const tables = [...thirdYear.querySelectorAll('table.courselist')].filter((table) => table.getBoundingClientRect().height > 0);
    return tables.map((table, index) => {
      const counts = {};
      table.querySelectorAll('.emnehjelper-pill').forEach((pill) => { counts[pill.classList[1]] = (counts[pill.classList[1]] ?? 0) + 1; });
      const heading = (table.closest('.directionContent') ?? table).querySelector('h3.studyperiod') ?? table;
      return {
        index,
        semester: heading.textContent.trim(),
        rows: [...table.querySelectorAll('tr.course, tr.courserow')].filter((row) => row.getBoundingClientRect().height > 0).length,
        counts,
        colours: Object.keys(counts).filter((colour) => colour !== 'gray').length,
        gray: counts.gray ?? 0,
        warnings: table.querySelectorAll('.emnehjelper-warning-row').length,
        height: table.getBoundingClientRect().bottom - heading.getBoundingClientRect().top,
      };
    });
  }, THIRD_YEAR_INDEX);
}

// Scroll so the table's semester heading sits just below the sticky header
async function scrollToThirdYearTable(page, tableIndex, offset) {
  await page.evaluate(([yearIndex, index, top]) => {
    const thirdYear = document.querySelectorAll('div.year')[yearIndex];
    const table = [...thirdYear.querySelectorAll('table.courselist')].filter((t) => t.getBoundingClientRect().height > 0)[index];
    const heading = (table.closest('.directionContent') ?? table).querySelector('h3.studyperiod') ?? table;
    window.scrollTo(0, heading.getBoundingClientRect().top + scrollY - top);
  }, [THIRD_YEAR_INDEX, tableIndex, offset]);
}

async function captureStudyPlan() {
  const { context } = await launchWithExtension({ profileName: 'light' });

  const page = await context.newPage();
  await openThirdYear(page);
  await waitForStudyPlanData(page);

  const headerBottom = await measureStickyHeaderBottom(page);
  const offset = headerBottom + HEADING_GAP_PX;
  const room = VIEWPORT.height - offset;
  const tables = await describeThirdYearTables(page);
  tables.forEach((table) => log('3rd-year table', JSON.stringify(table)));
  // Prefer a table that fits on screen, then the widest mix of badge colours, then the fewest grey badges
  const [best] = [...tables].sort((a, b) => ((b.height <= room) - (a.height <= room))
    || (b.colours - a.colours) || (a.gray - b.gray) || (b.rows - a.rows));
  if (best.height > room) warn(`the ${best.semester} table is taller than the viewport and will be cut off`);
  if (best.warnings) warn(`${best.warnings} row(s) in the ${best.semester} table show a data-fetch warning`);

  await scrollToThirdYearTable(page, best.index, offset);
  await settle(page);
  await page.screenshot({ path: outputPath('study-plan.png') });
  fs.writeFileSync(STUDY_PLAN_PICK_FILE, JSON.stringify({ index: best.index, offset }));
  log(`saved study-plan.png (${best.semester} table)`);
  await context.close();
}

// Same view in a browser without the extension, for a before/after image
async function captureStudyPlanWithout() {
  if (!fs.existsSync(STUDY_PLAN_PICK_FILE)) throw new Error('Run the "study" step first: it picks the table to show');
  const { index, offset } = JSON.parse(fs.readFileSync(STUDY_PLAN_PICK_FILE, 'utf8'));
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, colorScheme: 'light' });
  const page = await context.newPage();
  await openThirdYear(page);
  await scrollToThirdYearTable(page, index, offset);
  await settle(page);
  await page.screenshot({ path: outputPath('study-plan-without.png') });
  log('saved study-plan-without.png');
  await browser.close();
}

// ---------- Course page ----------

// The panel is expanded, its link checks are done and its logos have loaded
async function waitForPanel(page) {
  await page.waitForSelector('.popup .popup-inner', { timeout: DATA_TIMEOUT_MS });
  await page.waitForFunction(() => {
    const popup = document.querySelector('.popup');
    if (!popup || popup.classList.contains('minimized') || popup.classList.contains('expanding')) return false;
    if (popup.querySelector('.service-btn-loading')) return false;
    return [...popup.querySelectorAll('img')].every((image) => image.complete && image.naturalWidth > 0);
  }, null, { timeout: DATA_TIMEOUT_MS, polling: 500 });
}

// Log the panel's values and warn about anything that would look broken in store artwork
async function checkPanelValues(page) {
  const panel = await page.evaluate(() => {
    const popup = document.querySelector('.popup');
    return {
      stats: [...popup.querySelectorAll('.stat-value')].map((value) => value.textContent),
      sliders: [...popup.querySelectorAll('.slider-value-display')].map((value) => value.textContent),
      reviews: [...popup.querySelectorAll('.review-source-count')].map((count) => count.textContent),
      missingLinks: [...popup.querySelectorAll('.service-btn-invalid .service-btn-name')].map((name) => name.textContent),
      warning: popup.querySelector('.warning-banner')?.textContent.trim() ?? null,
    };
  });
  log('panel', JSON.stringify(panel));
  const placeholders = [...panel.stats, ...panel.sliders].filter((value) => value.includes('--'));
  if (placeholders.length) warn(`panel shows placeholder values: ${placeholders.join(', ')}`);
  if (panel.missingLinks.length) warn(`panel marks links as unavailable: ${panel.missingLinks.join(', ')}`);
  if (panel.warning) warn(`panel shows a warning banner: ${panel.warning}`);
}

// Element screenshot of just the panel, with its rounded corners cut out to transparency
async function capturePanel(page, file) {
  const popup = page.locator('.popup');
  // At 800px tall the panel caps its height and scrolls; make the window tall enough to show all of it
  // Header + content + 2px border + 40px for the panel's 10px margins and some slack
  const fullHeight = await popup.evaluate((element) => element.querySelector('.popup-header').offsetHeight
    + element.querySelector('.popup-content').scrollHeight + 2 + 40);
  await page.setViewportSize({ width: VIEWPORT.width, height: Math.max(VIEWPORT.height, fullHeight) });
  await page.waitForTimeout(600);
  const scrolls = await popup.evaluate((element) => {
    const content = element.querySelector('.popup-content');
    return content.scrollHeight > content.clientHeight;
  });
  if (scrolls) warn(`${file}: the panel still scrolls, so its bottom is cut off`);
  const screenshot = await popup.screenshot({ animations: 'disabled' });
  const radius = await popup.evaluate((element) => parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0);
  await page.setViewportSize(VIEWPORT);

  // Mask on a blank page: the NTNU page's CSP may refuse data: images
  const blank = await page.context().newPage();
  const masked = await blank.evaluate(async ([base64, cornerRadius]) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, cornerRadius);
    context.clip();
    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, [screenshot.toString('base64'), radius * DEVICE_SCALE_FACTOR]);
  await blank.close();
  fs.writeFileSync(outputPath(file), Buffer.from(masked, 'base64'));
  log(`saved ${file}`);
}

async function captureCoursePage({ colorScheme, forceDark = false, pageFile, panelFile }) {
  const { context } = await launchWithExtension({
    profileName: forceDark ? 'dark-forced' : colorScheme,
    colorScheme,
    extraArgs: forceDark ? FORCE_DARK_ARGS : [],
  });

  const page = await context.newPage();
  await page.goto(COURSE_URL, { waitUntil: 'networkidle' });
  await waitForPanel(page);
  await settle(page);
  await checkPanelValues(page);
  await page.screenshot({ path: outputPath(pageFile) });
  log(`saved ${pageFile}`);
  if (panelFile) await capturePanel(page, panelFile);
  await context.close();
}

// ---------- About popup ----------

// about.html at the popup's width, as tall as its content (Chrome sizes the real popup the same way)
async function captureAboutPopup() {
  const { context, extensionId } = await launchWithExtension({ profileName: 'light' });
  const page = await context.newPage();
  await page.setViewportSize({ width: ABOUT_POPUP_WIDTH, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/about.html`);
  await page.waitForFunction(() => document.getElementById('version')?.textContent !== 'v...');
  await settle(page);
  const height = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  await page.setViewportSize({ width: ABOUT_POPUP_WIDTH, height });
  await settle(page);
  await page.screenshot({ path: outputPath('about-popup.png'), fullPage: true });
  log(`saved about-popup.png (${ABOUT_POPUP_WIDTH}x${height})`);
  await context.close();
}

// ---------- Main ----------

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(OPTIONS.out, { recursive: true });
log(`extension: ${OPTIONS.ext}`);
log(`output: ${OPTIONS.out}`);
for (const step of OPTIONS.steps) {
  log(`== ${step}`);
  await STEPS[step]();
}
