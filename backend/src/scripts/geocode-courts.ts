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

async function geocodeCourt(page: any, court: MockCourt): Promise<{ lat: number; lng: number } | null> {
  const query = `${court.name} ${court.address} Đà Nẵng`;
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    // Wait for the page to load - look for the URL to update with coordinates
    await page.waitForTimeout(3000);

    // Try to extract coordinates from the current URL
    const currentUrl = page.url();
    const coordMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
    }

    // Try clicking the first result if available
    const firstResult = await page.$('div[role="feed"] > div > div:first-child a');
    if (firstResult) {
      await firstResult.click();
      await page.waitForTimeout(3000);
      const newUrl = page.url();
      const coordMatch2 = newUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch2) {
        return { lat: parseFloat(coordMatch2[1]), lng: parseFloat(coordMatch2[2]) };
      }
    }

    return null;
  } catch (e: any) {
    console.error(`  Error for ${court.name}: ${e.message}`);
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
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
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
    // Small delay to avoid rate limiting
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // Write updated data
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
