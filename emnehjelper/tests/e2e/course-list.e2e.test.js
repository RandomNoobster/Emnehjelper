// e2e-tests/extension.e2e.test.js
const path = require('path');
const puppeteer = require('puppeteer');
const { emnrData, karakterwebData } = require('../mockData');

describe('Emnehjelper E2E Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Absolute path to your extension folder
    const extensionPath = path.resolve(__dirname, '..', '..'); // up one level

    browser = await puppeteer.launch({
      headless: false, // Extension support generally requires a non-headless mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        // Some folks also add:
        // '--no-sandbox',
        // '--disable-setuid-sandbox'
      ],
    });

    page = await browser.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should load the extension and inject content script on matching page', async () => {
    // 1. Navigate to a page that triggers your "course-list.js" script
    await page.goto('https://www.ntnu.no/studier/mtdt/studieretninger-og-hovedprofiler#year=2024&programmeCode=MTDT');

    // 2. Because your content script runs at "document_idle" or "document_end",
    //    give it a moment to modify the DOM
    await new Promise((resolve) => setTimeout(resolve, 60 * 60 * 1000));

    // 3. Check if your extension's injected elements are present.
    //    For example, let's see if the extension added 'abbr.tag' elements:
    const abbrTags = await page.$$('abbr.tag');

    // 4. Make an assertion
    expect(abbrTags.length).toBeGreaterThan(0);

    // 5. Optionally, you can read the text or color classes to ensure correctness
    const abbrTexts = await page.$$eval('abbr.tag', (nodes) =>
      nodes.map((el) => el.textContent)
    );

    // For example, if your extension should show "Lett" or "Vanskelig" ...
    expect(abbrTexts).toContain('Lett');
  }, 60 * 1000); // 60 seconds timeout
});
