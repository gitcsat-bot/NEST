import argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma';

// Security Context: TDS §5.1, Security Design §4.
// Seeds the static permission keys, the default role mappings (A 5.1),
// and the permissions/role_permissions Phase-2 seam (A 4.5) with the
// capability matrix from TDS A 5.1. Run via `prisma db seed` after the
// first migration.
//
// User accounts: real account provisioning depends on the still-open
// Pre-Phase-0 decision (finalized Implementation Plan A 2, item 1:
// self-service registration vs. admin-provisioned) and is deliberately
// NOT decided here. What IS added below is a single dev-only test admin
// account, gated behind NODE_ENV !== 'production', purely so the auth
// flow (login + guards + step-up) has something to exercise locally
// before a real provisioning decision/mechanism exists. Do not treat
// this as the answer to the open item — it's scaffolding to unblock
// local testing, nothing more.
const prisma = new PrismaClient();

const CAPABILITY_MATRIX: Record<string, string[]> = {
  viewer: ['catalog.read', 'inventory.read', 'locations.read', 'own_checkouts.read', 'own_reservations.read'],
  student: ['asset.lifecycle_manage', 'inventory.request'],
  contributor: ['asset.write', 'inventory.write', 'checkout.write', 'attachment.write', 'reservation.write'],
  stores_manager: ['locations.write', 'inventory.adjust', 'asset.lifecycle_manage', 'asset.archive'],
  admin: ['user.manage', 'security_settings.manage', 'audit.read_full', 'report.generate', 'asset.hard_delete', 'asset.lifecycle_manage', 'locations.write'],
};

const DEV_TEST_USER_EMAIL = 'admin@nest.local';
const DEV_TEST_USER_PASSWORD = 'DevTestPassword123!'; // local-only, never a real credential

async function main() {
  await prisma.securitySettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }, // all other fields take their schema defaults
  });

  for (const [role, keys] of Object.entries(CAPABILITY_MATRIX)) {
    for (const key of keys) {
      const permission = await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: `Auto-seeded from TDS §5.1 for role: ${role}` },
      });
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: role as never, permissionId: permission.id } },
        update: {},
        create: { role: role as never, permissionId: permission.id },
      });
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    // `totpEnabled: true` is required here, not optional dressing — it's
    // what makes AuthService.login() actually take the 2FA branch for
    // these two accounts. Without it, `admin@nest.local`/`test@nest.local`
    // log in with a bare password and the "[TESTING] 2FA OTP for ..."
    // console-log exception branch in auth.service.ts is simply never
    // reached from seeded data (a bug found in the Phase 1 status audit —
    // the exception-account code path existed but nothing wired it up).
    const passwordHash = await argon2.hash(DEV_TEST_USER_PASSWORD);
    await prisma.user.upsert({
      where: { email: DEV_TEST_USER_EMAIL },
      update: { totpEnabled: true },
      create: {
        email: DEV_TEST_USER_EMAIL,
        passwordHash,
        displayName: 'Dev Test Admin',
        role: 'admin' as never,
        misId: '612015001',
        gender: 'other' as never,
        whatsappNumber: '+1234567890',
        subsystem: 'Onboard Computer',
        teamRole: 'Project Manager',
        isActive: true,
        emailVerified: true,
        totpEnabled: true,
      } as any,
    });
    console.log(`Dev test user ready: ${DEV_TEST_USER_EMAIL} / ${DEV_TEST_USER_PASSWORD} (2FA OTP prints to this console on login)`);

    const TEST_USER_EMAIL = 'test@nest.local';
    const TEST_USER_PASSWORD = 'TestPassword123!';
    const testPasswordHash = await argon2.hash(TEST_USER_PASSWORD);
    await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: { totpEnabled: true },
      create: {
        email: TEST_USER_EMAIL,
        passwordHash: testPasswordHash,
        displayName: 'Test Viewer User',
        role: 'viewer' as never,
        misId: '612015002',
        gender: 'prefer_not_to_say' as never,
        whatsappNumber: '+1234567891',
        subsystem: 'ADCS (Software)',
        teamRole: 'Subsystem Lead',
        isActive: true,
        emailVerified: true,
        totpEnabled: true,
      } as any,
    });
    console.log(`Test user ready: ${TEST_USER_EMAIL} / ${TEST_USER_PASSWORD} (2FA OTP prints to this console on login)`);

    // A third dev/test exception account, already approved as `student`
    // (not just pending) — so student-only features (Materials status
    // change, inventory quantity requests, catalog deletion requests)
    // have something to log in and test with immediately, without first
    // walking through the register → admin-approve flow by hand. Also
    // registered in mail-worker.service.ts's default console-test-account
    // list, so its 2FA OTPs and password-reset emails print here too.
    const STUDENT_USER_EMAIL = 'student@nest.local';
    const STUDENT_USER_PASSWORD = 'StudentPassword123!';
    const studentPasswordHash = await argon2.hash(STUDENT_USER_PASSWORD);
    await prisma.user.upsert({
      where: { email: STUDENT_USER_EMAIL },
      update: { totpEnabled: true },
      create: {
        email: STUDENT_USER_EMAIL,
        passwordHash: studentPasswordHash,
        displayName: 'Test Student',
        role: 'student' as never,
        misId: '612015004',
        gender: 'male' as never,
        whatsappNumber: '+1234567892',
        subsystem: 'Power',
        teamRole: 'Member',
        isActive: true,
        emailVerified: true,
        totpEnabled: true,
      } as any,
    });
    console.log(`Test student user ready: ${STUDENT_USER_EMAIL} / ${STUDENT_USER_PASSWORD} (already approved as student; 2FA OTP prints to this console on login)`);

    // A second, non-exception viewer account pending a `student` role
    // approval — so the new Admin Approvals screen has something to show
    // out of the box without needing to register a fresh account by hand.
    const PENDING_STUDENT_EMAIL = 'pending-student@nest.local';
    const pendingStudentHash = await argon2.hash('PendingStudent123!');
    await prisma.user.upsert({
      where: { email: PENDING_STUDENT_EMAIL },
      update: {},
      create: {
        email: PENDING_STUDENT_EMAIL,
        passwordHash: pendingStudentHash,
        displayName: 'Pending Student',
        role: 'viewer' as never,
        pendingRole: 'student' as never,
        misId: '000000003',
        gender: 'female' as never,
        isActive: true,
        emailVerified: true,
        totpEnabled: false,
      } as any,
    });
    console.log(`Pending-approval user ready: ${PENDING_STUDENT_EMAIL} / PendingStudent123! (viewer, pending_role=student)`);

    // Demo Materials MVP data (Implementation Plan checklist items 4/5) —
    // one location, one catalog entry, one material below its reorder
    // threshold so the Materials/Reports screens render real content
    // immediately instead of an empty state.
    const demoLocation = await prisma.location.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Warehouse',
        type: 'warehouse' as never,
      },
    });
    const demoAssetDefinition = await prisma.assetDefinition.upsert({
      where: { sku: 'DEMO-0001' },
      update: {},
      create: {
        sku: 'DEMO-0001',
        name: 'Demo Widget',
        description: 'Seed-only demo catalog entry for the Materials MVP screens.',
      },
    });
    await prisma.inventoryItem.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        assetDefinitionId: demoAssetDefinition.id,
        locationId: demoLocation.id,
        quantityOnHand: 3,
        reorderThreshold: 5,
        unit: 'pcs',
      },
    });
    console.log('Demo material ready: DEMO-0001 @ Demo Warehouse (3 on hand, reorder at 5)');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
