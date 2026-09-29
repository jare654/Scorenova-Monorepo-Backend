import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Removes non-OTP profile columns from the `otps` table:
 * full_name, user_type, gender, birthday, email, city, address, grade_id, stream_id.
 * User profile information during registration is saved directly into the `accounts` table.
 */
export class RemoveUserProfileFromOtpsTable1700000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnsToDrop = [
      "full_name",
      "user_type",
      "gender",
      "birthday",
      "email",
      "city",
      "address",
      "grade_id",
      "stream_id",
    ];

    for (const col of columnsToDrop) {
      await queryRunner.query(`
        ALTER TABLE "otps" DROP COLUMN IF EXISTS "${col}"
      `);
    }
    console.log("  ▸ Dropped non-OTP user profile columns from otps table.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "full_name" VARCHAR`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "user_type" VARCHAR`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "gender" VARCHAR`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "birthday" DATE`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "email" VARCHAR`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "city" VARCHAR`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "address" TEXT`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "grade_id" UUID`);
    await queryRunner.query(`ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "stream_id" UUID`);
  }
}
