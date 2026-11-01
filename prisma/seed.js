/**
 * Idempotent seed for local development and lab environments.
 *
 * Creates one ADMIN user plus a few starter categories (SDD section 18 step 4).
 * Credentials come from SEED_ADMIN_* environment variables, never hardcoded in
 * application code. Run with `npm run prisma:seed`.
 */
const bcrypt = require('bcrypt');
const { PrismaClient, UserRole } = require('@prisma/client');

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
const adminName = process.env.SEED_ADMIN_NAME || 'Administrator';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'password123';

const categories = [
  { name: 'Elektronik', description: 'Perangkat elektronik dan aksesorisnya' },
  { name: 'Alat Tulis Kantor', description: 'Kebutuhan administrasi harian' },
  { name: 'Furniture', description: 'Perabot kantor' },
];

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error('SEED_ADMIN_PASSWORD is required when seeding a production database');
  }

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, passwordHash, role: UserRole.ADMIN },
    create: { name: adminName, email: adminEmail, passwordHash, role: UserRole.ADMIN },
  });

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: category,
    });
  }

  console.log(`[seed] admin ready: ${admin.email} (id=${admin.id.toString()})`);
  console.log(`[seed] categories ready: ${categories.length}`);
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
