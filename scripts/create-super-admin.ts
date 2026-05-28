import { db } from "../lib/db";
import bcrypt from "bcryptjs";

async function main() {
  // ── 1. Create super-admin login ──────────────────────────────────────────
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "josh@bizshark.co";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) throw new Error("Set ADMIN_PASSWORD env var before running");

  const existing = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`ℹ️   Super admin already exists: ${ADMIN_EMAIL}`);
  } else {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await db.user.create({
      data: { email: ADMIN_EMAIL, passwordHash: hash, name: "Josh", role: "super_admin" },
    });
    console.log(`✅  Super admin created: ${ADMIN_EMAIL}`);
  }

  // ── 2. Comp the dealfloai operator (agency, no billing required) ─────────
  const COMP_EMAIL = "joshuas@dealfloai.com";
  const op = await db.operator.findUnique({ where: { email: COMP_EMAIL } });
  if (!op) {
    console.log(`⚠️   Operator not found: ${COMP_EMAIL} — sign up first, then re-run.`);
  } else {
    await db.operator.update({
      where: { id: op.id },
      data: {
        subscriptionStatus: "active",
        subscriptionTier: "agency",
        onboardingCompletedAt: op.onboardingCompletedAt ?? new Date(),
      },
    });
    console.log(`✅  ${COMP_EMAIL} → agency / active (comped)`);
  }

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
