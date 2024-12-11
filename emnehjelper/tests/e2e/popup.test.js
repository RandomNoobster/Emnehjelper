import { launch } from 'puppeteer';

let browser;
let page;

beforeAll(async () => {
  browser = await launch();
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

test('should display popup with correct data', async () => {
  await page.goto('https://www.ntnu.no/studier/emner/TDT4100');
  // Add logic to trigger the popup
  const popupContent = await page.$eval('.popup', el => el.textContent);
  expect(popupContent).toContain('Expected text');
});