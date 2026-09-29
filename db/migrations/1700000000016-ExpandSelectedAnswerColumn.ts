import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandSelectedAnswerColumn1700000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: skip if attempts table doesn't exist yet
    const attemptsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'attempts'
    `);
    if (attemptsExists.length === 0) {
      console.log("  ▸ attempts table does not exist — skipping ExpandSelectedAnswerColumn.");
      return;
    }

    // 1. Expand selected_answer to TEXT if it isn't already
    const colInfo = await queryRunner.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'attempts'
        AND column_name  = 'selected_answer'
    `);
    if (colInfo.length > 0 && colInfo[0].data_type !== 'text') {
      await queryRunner.query(`
        ALTER TABLE "attempts"
        ALTER COLUMN "selected_answer" TYPE TEXT
      `);
      console.log("  ▸ Altered attempts.selected_answer to TEXT.");
    }

    // 2. Make topic_id nullable if not already
    await queryRunner.query(`
      ALTER TABLE "attempts"
      ALTER COLUMN "topic_id" DROP NOT NULL
    `).catch(() => { /* already nullable — ignore */ });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const attemptsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'attempts'
    `);
    if (attemptsExists.length === 0) return;

    await queryRunner.query(`
      ALTER TABLE "attempts"
      ALTER COLUMN "selected_answer" TYPE VARCHAR(50)
    `);
  }
}
