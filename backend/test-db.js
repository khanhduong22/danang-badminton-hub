const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const courts = await prisma.court.findMany();
  console.log(courts.map(c => ({ name: c.name, lat: c.latitude, lng: c.longitude })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
