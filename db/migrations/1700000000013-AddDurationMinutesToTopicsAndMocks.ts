import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add `duration_minutes` to `topics` and `mock_exams` tables.
 */
export class AddDurationMinutesToTopicsAndMocks1700000000013
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "topics"
      ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "mock_exams"
      ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NULL;
    `);

    console.log("  ▸ Added duration_minutes column to topics and mock_exams tables.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "topics"
      DROP COLUMN IF EXISTS "duration_minutes";
    `);

    await queryRunner.query(`
      ALTER TABLE "mock_exams"
      DROP COLUMN IF EXISTS "duration_minutes";
    `);
  }
}
