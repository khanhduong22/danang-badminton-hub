import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to mbasic.facebook.com/login/...");
  await page.goto('https://mbasic.facebook.com/login/', { waitUntil: 'domcontentloaded' });
  
  // check for cookie consent
  const cookieButton = await page.$('button[name="accept_only_essential"], button[name="accept_all"], a[href*="cookie/consent"]');
  if (cookieButton) {
    console.log('🍪 Cookie Consent button found! Clicking...');
    await cookieButton.click();
    await page.waitForLoadState('domcontentloaded');
  }

  // wait for email
  console.log('Waiting for email input...');
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  
  console.log('Filling credentials...');
  await page.fill('input[name="email"]', process.env.FB_EMAIL || '');
  await page.waitForTimeout(500);
  await page.fill('input[name="pass"]', process.env.FB_PASSWORD || '');
  await page.waitForTimeout(500);

  console.log('Submitting login...');
  await page.click('input[type="submit"][name="login"], input[name="login"], button[name="login"]');
  
  try {
    await page.waitForURL((url) => !url.toString().includes('/login/'), { timeout: 15000 });
  } catch {}

  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);
  
  if (finalUrl.includes('checkpoint')) {
    console.log('❌ Hit checkpoint!');
  } else {
    console.log('✅ Login successful!');
    const cookies = await context.cookies();
    console.log(`Saved ${cookies.length} cookies.`);
  }

  await browser.close();
})();
