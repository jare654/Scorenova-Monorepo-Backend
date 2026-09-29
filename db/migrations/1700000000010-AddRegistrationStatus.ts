import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds registration_status lifecycle to the accounts table:
 *
 * 1. Adds `status` column (pending_otp → pending_details → pending_password → active)
 * 2. Backfills existing rows: otpVerified + password → active, otherwise pending_otp
 * 3. Adds DB-level CHECK constraint so 'active' rows always have a password
 * 4. Adds INDEX on status for efficient cleanup queries
 */
export class AddRegistrationStatus1700000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Add status column if it doesn't exist ──────────────────────────
    const colExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'accounts'
        AND column_name  = 'status'
    `);

    if (colExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "accounts"
        ADD COLUMN "status" VARCHAR(32) NOT NULL DEFAULT 'pending_otp'
      `);
      console.log("  ▸ Added accounts.status column");
    }

    // ── 2. Backfill: fully registered accounts → active ───────────────────
    const otpVerifiedExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'accounts'
        AND column_name  = 'otp_verified'
    `);

    if (otpVerifiedExists.length > 0) {
      await queryRunner.query(`
        UPDATE "accounts"
        SET "status" = 'active'
        WHERE "otp_verified" = TRUE
          AND "password" IS NOT NULL
          AND "status" = 'pending_otp'
      `);
    } else {
      await queryRunner.query(`
        UPDATE "accounts"
        SET "status" = 'active'
        WHERE "is_active" = TRUE
          AND "password" IS NOT NULL
          AND "password" != ''
          AND "status" = 'pending_otp'
      `);
    }
    console.log("  ▸ Backfilled existing active accounts to status='active'");

    // ── 3. Add CHECK constraint for valid status values ───────────────────
    await queryRunner.query(`
      ALTER TABLE "accounts"
      DROP CONSTRAINT IF EXISTS "CHK_accounts_status_values"
    `);
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_status_values"
      CHECK (status IN ('pending_otp', 'pending_details', 'pending_password', 'active'))
    `);

    // ── 4. Add CHECK constraint: active accounts must have a password ─────
    await queryRunner.query(`
      ALTER TABLE "accounts"
      DROP CONSTRAINT IF EXISTS "CHK_accounts_password_required_when_active"
    `);
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_password_required_when_active"
      CHECK (status != 'active' OR password IS NOT NULL)
    `);

    // ── 5. Add index on status for cleanup queries ─────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_accounts_status"
      ON "accounts" ("status")
    `);

    console.log("  ▸ Registration status migration complete.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_accounts_status"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_password_required_when_active"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_status_values"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "status"`);
  }
}
