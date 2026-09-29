import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to create `temp_device_token` table for storing device tags and FCM push tokens.
 */
export class CreateTempDeviceTokenTable1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "temp_device_token" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "device_tag" VARCHAR(255) NOT NULL UNIQUE,
        "fcm_token" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_temp_device_token_device_tag"
      ON "temp_device_token" ("device_tag");
    `);

    console.log("  ▸ Created temp_device_token table and unique device_tag index.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "temp_device_token" CASCADE;`);
  }
}
