import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://mbasic.facebook.com/login/', { waitUntil: 'domcontentloaded' });
  
  // click cookie consent
  const cookieButton = await page.$('button[name="accept_only_essential"], button[name="accept_all"], button[value="1"], input[value="1"][type="submit"]');
  if (cookieButton) {
    console.log('Clicking cookie consent...');
    await cookieButton.click();
    await page.waitForLoadState('domcontentloaded');
  }

  // fill form
  const emailInput = await page.$('input[name="email"]');
  if (emailInput) {
    console.log('Email input found!');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="pass"]', 'password123');
    
    // click submit
    const submitBtn = await page.$('input[type="submit"][name="login"], input[name="login"], button[name="login"], input[type="submit"]');
    if (submitBtn) {
      console.log('Submit button found!');
    } else {
      console.log('Submit button NOT found!');
    }
  } else {
    console.log('Email input NOT found!');
  }

  await browser.close();
})();
