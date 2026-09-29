import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add missing CommonEntity and feature columns across tables
 * (accounts, subjects, topics, mock_exams, sessions, roles, permissions).
 */
export class AddMissingCommonAndEntityColumns1700000000014
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. accounts table CommonEntity columns ───────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD COLUMN IF NOT EXISTS "created_by" VARCHAR,
      ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "deleted_by" VARCHAR,
      ADD COLUMN IF NOT EXISTS "archive_reason" TEXT;
    `);

    // ── 2. subjects table missing columns ────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "subjects"
      ADD COLUMN IF NOT EXISTS "is_free" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "access_type" VARCHAR(20) NOT NULL DEFAULT 'paid';
    `);

    // ── 3. topics table missing columns ──────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "topics"
      ADD COLUMN IF NOT EXISTS "is_free" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "access_type" VARCHAR(20) NOT NULL DEFAULT 'paid';
    `);

    // ── 4. mock_exams table missing columns ──────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "mock_exams"
      ADD COLUMN IF NOT EXISTS "is_free" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "access_type" VARCHAR(20) NOT NULL DEFAULT 'paid';
    `);

    // ── 5. sessions table CommonEntity columns (if sessions table exists) ────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "account_id" UUID NOT NULL,
        "refresh_token" TEXT NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "created_by" VARCHAR,
      ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "deleted_by" VARCHAR,
      ADD COLUMN IF NOT EXISTS "archive_reason" TEXT;
    `);

    console.log("  ▸ Added missing CommonEntity and feature columns across tables.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op for safety
  }
}
