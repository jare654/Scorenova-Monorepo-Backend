import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStreamIdToAccounts1700000000002 implements MigrationInterface {
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

    // ── Guard: ensure otps table exists (fresh DB) ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otps" (
        "id"              uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "phone_number"    character varying        NOT NULL,
        "otp"             character varying(6)     NOT NULL DEFAULT '',
        "verification_id" character varying        NOT NULL DEFAULT '',
        "expires_at"      TIMESTAMP WITH TIME ZONE NOT NULL,
        "verified"        boolean                  NOT NULL DEFAULT false,
        "created_at"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otps" PRIMARY KEY ("id")
      )
    `);

    // ── accounts.stream_id ────────────────────────────────────────────────────
    const accountStreamExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'accounts'
        AND column_name  = 'stream_id'
    `);
    if (accountStreamExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "accounts" ADD COLUMN "stream_id" uuid NULL
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_accounts_stream_id" ON "accounts" ("stream_id")
      `);
    }

    // ── otps.stream_id ────────────────────────────────────────────────────────
    const otpStreamExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'otps'
        AND column_name  = 'stream_id'
    `);
    if (otpStreamExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "otps" ADD COLUMN "stream_id" uuid NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_accounts_stream_id"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN IF EXISTS "stream_id"`);
    await queryRunner.query(`ALTER TABLE "otps" DROP COLUMN IF EXISTS "stream_id"`);
  }
}
