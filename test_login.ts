import { chromium } from 'playwright';

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
  } else {
    console.log('No cookie consent button found.');
  }

  // check if email input exists
  const emailInput = await page.$('input[name="email"]');
  if (emailInput) {
    console.log('✅ Found email input!');
  } else {
    console.log('❌ Could not find email input!');
    const content = await page.content();
    console.log(content.substring(0, 1500));
  }

  await browser.close();
})();
