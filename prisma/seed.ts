import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Intentionally minimal: seed is optional for MVP.
  // You can add demo content here later.
  await prisma.$connect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
