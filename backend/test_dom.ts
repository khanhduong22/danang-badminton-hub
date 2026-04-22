import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://mbasic.facebook.com/login/');
  await page.waitForLoadState('domcontentloaded');
  
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input, button')).map(i => ({tag: i.tagName, name: i.name, type: i.type, value: i.value})));
  console.log('Inputs found:', inputs);

  await browser.close();
})();
