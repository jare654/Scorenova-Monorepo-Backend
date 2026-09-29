import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMockExamStatus1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: ensure uuid-ossp is available ─────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Guard: ensure subjects table exists (mock_exams has FK to subjects) ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subjects" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "name"        character varying(255)   NOT NULL,
        "description" text,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subjects" PRIMARY KEY ("id")
      )
    `);

    // ── Guard: ensure mock_exams table exists (fresh DB) ────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_exams" (
        "id"             uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "subject_id"     uuid                     NOT NULL,
        "label"          character varying(100)   NOT NULL DEFAULT '',
        "question_count" integer                  NOT NULL DEFAULT 0,
        "questions"      jsonb                    NOT NULL DEFAULT '[]',
        "status"         character varying(20)    NOT NULL DEFAULT 'completed',
        "error_message"  text,
        "created_at"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mock_exams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mock_exams_subject"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mock_exams_subject_id"
      ON "mock_exams" ("subject_id")
    `);

    // ── Add status column if not already present ─────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "mock_exams"
      ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'completed'
    `);

    // ── Add error_message column if not already present ──────────────────────
    await queryRunner.query(`
      ALTER TABLE "mock_exams"
      ADD COLUMN IF NOT EXISTS "error_message" TEXT NULL
    `);

    // ── Set questions column default to empty array ───────────────────────────
    // Use information_schema to check if column exists before altering default.
    const questionsColExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'mock_exams'
        AND column_name  = 'questions'
    `);
    if (questionsColExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "mock_exams"
        ALTER COLUMN "questions" SET DEFAULT '[]'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: skip if mock_exams table doesn't exist ────────────────────────
    const mockExamsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'mock_exams'
    `);
    if (mockExamsExists.length === 0) return;

    await queryRunner.query(`ALTER TABLE "mock_exams" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`ALTER TABLE "mock_exams" DROP COLUMN IF EXISTS "error_message"`);
  }
}
