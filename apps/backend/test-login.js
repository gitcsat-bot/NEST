const argon2 = require('argon2');
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function test() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@nest.local' } });
  if (!user) {
    console.log("User not found!");
    return;
  }
  const valid = await argon2.verify(user.passwordHash, 'DevTestPassword123!');
  console.log("Is password valid?", valid);
}
test().finally(() => prisma.$disconnect());
