import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandCorrectAnswerColumn1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: ensure uuid-ossp is available ─────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Guard: skip if questions table doesn't exist yet ────────────────────
    const questionsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'questions'
    `);
    if (questionsExists.length === 0) {
      console.log("  ▸ questions table does not exist — skipping ExpandCorrectAnswerColumn.");
      return;
    }

    // 1. Expand correct_answer to TEXT if it isn't already
    const colInfo = await queryRunner.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'questions'
        AND column_name  = 'correct_answer'
    `);
    if (colInfo.length > 0 && colInfo[0].data_type !== 'text') {
      await queryRunner.query(`
        ALTER TABLE "questions"
        ALTER COLUMN "correct_answer" TYPE TEXT
      `);
    }

    // 2. Make topic_id nullable (DROP NOT NULL is safe even if already nullable)
    await queryRunner.query(`
      ALTER TABLE "questions"
      ALTER COLUMN "topic_id" DROP NOT NULL
    `).catch(() => { /* already nullable — ignore */ });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: skip if questions table doesn't exist ─────────────────────────
    const questionsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'questions'
    `);
    if (questionsExists.length === 0) return;

    await queryRunner.query(`
      ALTER TABLE "questions"
      ALTER COLUMN "correct_answer" TYPE VARCHAR(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "questions"
      ALTER COLUMN "topic_id" SET NOT NULL
    `);
  }
}
