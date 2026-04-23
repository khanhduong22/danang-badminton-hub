import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface MockCourt {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

async function acceptConsent(page: any) {
  // Google shows consent page for EU IPs (Contabo is in Germany)
  try {
    const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="accept"], button[aria-label*="Agree"], button[aria-label*="agree"], form[action*="consent"] button');
    if (consentBtn) {
      await consentBtn.click();
      await page.waitForTimeout(2000);
      console.log("Accepted consent page");
    }
  } catch {
    // No consent page, continue
  }
}

async function geocodeCourt(page: any, court: MockCourt): Promise<{ lat: number; lng: number } | null> {
  const query = `${court.name} ${court.address}`;
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await acceptConsent(page);
    await page.waitForTimeout(4000);

    // Extract coordinates from URL
    const currentUrl = page.url();
    const coordMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
    }

    // Try clicking first search result
    try {
      const firstResult = await page.waitForSelector('div[role="feed"] a, a[href*="/maps/place/"]', { timeout: 5000 });
      if (firstResult) {
        await firstResult.click();
        await page.waitForTimeout(4000);
        const newUrl = page.url();
        const coordMatch2 = newUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch2) {
          return { lat: parseFloat(coordMatch2[1]), lng: parseFloat(coordMatch2[2]) };
        }
      }
    } catch {
      // No results found
    }

    return null;
  } catch (e: any) {
    return null;
  }
}

async function main() {
  const filePath = join(process.cwd(), "../src/data/mockCourts.json");
  const raw = readFileSync(filePath, "utf-8");
  const courts: MockCourt[] = JSON.parse(raw);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "vi-VN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  // Pre-accept Google consent by visiting maps first
  const consentPage = await context.newPage();
  await consentPage.goto("https://www.google.com/maps", { waitUntil: "domcontentloaded", timeout: 20000 });
  await acceptConsent(consentPage);
  await consentPage.waitForTimeout(2000);
  await consentPage.close();

  const page = await context.newPage();
  let updated = 0;
  let failed: string[] = [];

  for (const court of courts) {
    process.stdout.write(`Geocoding ${court.id}: ${court.name}... `);
    const coords = await geocodeCourt(page, court);
    if (coords) {
      court.latitude = coords.lat;
      court.longitude = coords.lng;
      updated++;
      console.log(`OK (${coords.lat}, ${coords.lng})`);
    } else {
      failed.push(court.id);
      console.log("FAILED");
    }
    await page.waitForTimeout(1500);
  }

  await browser.close();

  writeFileSync(filePath, JSON.stringify(courts, null, 2) + "\n");
  console.log(`\nDone! Updated: ${updated}/${courts.length}`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
