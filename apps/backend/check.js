const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { email: true, emailVerified: true } });
  console.log(users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
