import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all existing users...');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE users CASCADE;`);
  console.log('Users deleted.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
