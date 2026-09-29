import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds premium subscription fields to the accounts table.
 * These columns support the premium access control system:
 *   - premium_start_date: when the subscription started
 *   - premium_end_date:   when the subscription expires (null = no expiry)
 *   - premium_plan:       plan label e.g. "Monthly", "Quarterly", "Annual"
 */
export class AddPremiumFieldsToAccounts1700000000006 implements MigrationInterface {
  name = "AddPremiumFieldsToAccounts1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: ensure uuid-ossp is available ─────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Guard: ensure accounts table exists (fresh DB) ───────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id"           uuid                     NOT NULL,
        "name"         character varying        NOT NULL DEFAULT '',
        "phone_number" character varying        NOT NULL DEFAULT '',
        "type"         character varying        NOT NULL DEFAULT '',
        "is_active"    boolean                  NOT NULL DEFAULT true,
        "password"     character varying        NOT NULL DEFAULT '',
        "is_premium"   boolean                  NOT NULL DEFAULT false,
        "created_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id")
      )
    `);

    // Add is_premium column if it was not part of the original table
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD COLUMN IF NOT EXISTS "is_premium" BOOLEAN NOT NULL DEFAULT false
    `);

    // Add premium_start_date column (nullable timestamptz)
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD COLUMN IF NOT EXISTS "premium_start_date" TIMESTAMPTZ NULL
    `);

    // Add premium_end_date column (nullable timestamptz)
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD COLUMN IF NOT EXISTS "premium_end_date" TIMESTAMPTZ NULL
    `);

    // Add premium_plan column (nullable varchar)
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD COLUMN IF NOT EXISTS "premium_plan" VARCHAR(50) NULL
    `);

    // Index on premium_end_date for efficient expiry queries
    // Guard: only create if is_premium column now exists (it will after the ADD COLUMN above)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_accounts_premium_end_date"
      ON "accounts" ("premium_end_date")
      WHERE "is_premium" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: skip if accounts table doesn't exist ──────────────────────────
    const accountsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'accounts'
    `);
    if (accountsExists.length === 0) return;

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_accounts_premium_end_date"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "premium_plan"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "premium_end_date"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "premium_start_date"`);
  }
}
