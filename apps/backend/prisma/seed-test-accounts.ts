import argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma';

// ---------------------------------------------------------------------------
// Test-Account Seeder
// ---------------------------------------------------------------------------
// Provisions 10 isolated "Test Email" accounts directly into the database.
// These bypass the normal self-service registration flow entirely — no OTP,
// no email verification step. The accounts are designed to let developers
// exercise every role's view of the app via the Node/terminal without
// touching real user data.
//
// Security contract:
//   - MIS IDs are the reserved repeating-digit values (000000000–999999999).
//     The production `IsMisIdConstraint` validator rejects these at the DTO
//     layer, so no real user can claim them via the register endpoint.
//   - All 10 emails (test-0@nest.local … test-9@nest.local) are listed in
//     MAIL_CONSOLE_TEST_ACCOUNTS so 2FA OTPs and password-reset links print
//     to the backend terminal rather than going to a real mailbox.
//   - Every account is role=viewer. They can READ normal user/catalog/
//     inventory data but cannot mutate anything — they have no elevated
//     permissions and no pending role requests.
//   - They are excluded from the Admin "Users" panel by the NOT-misId filter
//     in UsersService.list(), so admins never see or interact with them.
//   - This script is SAFE to run in production (it uses upsert), but the
//     accounts it creates are useless there because TOTP is enforced and the
//     OTP only prints to the local terminal. They are "test-only" by design.
//
// Usage (from the apps/backend directory):
//   npx ts-node -P tsconfig.json -r tsconfig-paths/register prisma/seed-test-accounts.ts
//
// Or use the npm script:
//   pnpm --filter backend seed:test
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

interface TestAccount {
  email: string;
  misId: string;
  displayName: string;
  password: string;
}

// 10 accounts: test-0 through test-9.
// MIS IDs are reserved repeating-digit strings — the production
// IsMisIdConstraint rejects these, so real users can never claim them.
const TEST_ACCOUNTS: TestAccount[] = Array.from({ length: 10 }, (_, i) => ({
  email: `test-${i}@nest.local`,
  misId: `${i}`.repeat(9),
  displayName: `Test Account ${i}`,
  password: `TestAcc${i}Pass123!`,
}));

async function main() {
  console.log('─────────────────────────────────────────');
  console.log('  NEST — Test Account Seeder');
  console.log('─────────────────────────────────────────');
  console.log('Provisioning 10 viewer-only test accounts.\n');

  for (const account of TEST_ACCOUNTS) {
    const passwordHash = await argon2.hash(account.password);
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        // Re-lock to viewer on each run to prevent accidental role escalation
        role: 'viewer' as never,
        pendingRole: null,
        isActive: true,
        emailVerified: true,
        totpEnabled: true,
      },
      create: {
        email: account.email,
        passwordHash,
        displayName: account.displayName,
        role: 'viewer' as never,
        pendingRole: null,
        misId: account.misId,
        gender: 'prefer_not_to_say' as never,
        isActive: true,
        emailVerified: true,
        // totpEnabled=true: login triggers 2FA, OTP prints to terminal via
        // the mail-worker console-test-account path (no real email sent).
        totpEnabled: true,
      } as any,
    });

    console.log(
      `  MIS ${account.misId}  |  ${account.email}  |  pw: ${account.password}  |  OTP → terminal`,
    );
  }

  console.log('\n─────────────────────────────────────────');
  console.log('All 10 test accounts ready.');
  console.log('Login flow: email + password → 2FA code (read from this terminal).');
  console.log('These accounts are viewer-only and hidden from the Admin Users panel.');
  console.log('─────────────────────────────────────────');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
