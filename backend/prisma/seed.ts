import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

interface MockCourt {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contact_number?: string;
  zalo_url?: string;
  maps_url?: string;
  image_urls: string[];
  num_of_courts?: number;
  price_range?: string;
  tags: string[];
  created_at: string;
}

async function main() {
  const filePath = join(process.cwd(), "../src/data/mockCourts.json");
  const raw = readFileSync(filePath, "utf-8");
  const courts: MockCourt[] = JSON.parse(raw);

  console.log(`Seeding ${courts.length} courts...`);

  let created = 0;
  let updated = 0;

  for (const court of courts) {
    const existing = await prisma.court.findUnique({
      where: { id: parseInt(court.id.replace("court-", "")) },
    });

    if (existing) {
      await prisma.court.update({
        where: { id: existing.id },
        data: {
          name: court.name,
          address: court.address,
          latitude: court.latitude ?? null,
          longitude: court.longitude ?? null,
          contact_number: court.contact_number || null,
          zalo_url: court.zalo_url || null,
          maps_url: court.maps_url || null,
          image_urls: court.image_urls ?? [],
          num_of_courts: court.num_of_courts ?? null,
          price_range: court.price_range || null,
          tags: court.tags ?? [],
        },
      });
      updated++;
    } else {
      await prisma.court.create({
        data: {
          id: parseInt(court.id.replace("court-", "")),
          name: court.name,
          address: court.address,
          latitude: court.latitude ?? null,
          longitude: court.longitude ?? null,
          contact_number: court.contact_number || null,
          zalo_url: court.zalo_url || null,
          maps_url: court.maps_url || null,
          image_urls: court.image_urls ?? [],
          num_of_courts: court.num_of_courts ?? null,
          price_range: court.price_range || null,
          tags: court.tags ?? [],
        },
      });
      created++;
    }
  }

  const total = await prisma.court.count();
  console.log(`Done! Created: ${created}, Updated: ${updated}, Total in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
