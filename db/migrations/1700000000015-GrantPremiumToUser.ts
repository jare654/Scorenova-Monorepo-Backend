import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to grant premium access to specified account.
 */
export class GrantPremiumToUser1700000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "accounts"
      SET "is_premium" = true,
          "premium_plan" = 'yearly',
          "premium_start_date" = NOW(),
          "premium_end_date" = NOW() + INTERVAL '5 years'
      WHERE REPLACE(REPLACE(REPLACE("phone_number", '+', ''), ' ', ''), '-', '') LIKE '%798687678';
    `);

    console.log("  ▸ Granted premium access to user with phone number ending in 798687678.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
