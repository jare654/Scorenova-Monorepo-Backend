import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStreamsTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 0. Ensure uuid-ossp extension ────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── 0a. Create grades table if it doesn't exist (fresh DB) ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grades" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "name"        character varying(20)    NOT NULL,
        "description" text,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grades" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_grades_name" ON "grades" ("name")
    `);

    // ── 0b. Create subjects table if it doesn't exist (fresh DB) ────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subjects" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "name"        character varying(255)   NOT NULL,
        "description" text,
        "grade_id"    uuid,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subjects" PRIMARY KEY ("id")
      )
    `);

    // ── 0c. Create topics table if it doesn't exist (fresh DB) ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "topics" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "subject_id"  uuid                     NOT NULL,
        "name"        character varying(255)   NOT NULL,
        "description" text,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_topics" PRIMARY KEY ("id"),
        CONSTRAINT "FK_topics_subject"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_topics_subject_id_name"
      ON "topics" ("subject_id", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_topics_subject_id"
      ON "topics" ("subject_id")
    `);

    // ── 0d. Create questions table if it doesn't exist (fresh DB) ───────────
    // Required before step 10 which creates question_explanations with FK to questions.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questions" (
        "id"             uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "subject_id"     uuid                     NOT NULL,
        "topic_id"       uuid,
        "text"           text                     NOT NULL,
        "options"        jsonb,
        "correct_answer" text                     NOT NULL,
        "difficulty"     character varying(10)    NOT NULL DEFAULT 'medium',
        "explanation"    text,
        "created_at"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_questions_subject"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_questions_topic"
          FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questions_subject_id"
      ON "questions" ("subject_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questions_topic_id"
      ON "questions" ("topic_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questions_subject_topic"
      ON "questions" ("subject_id", "topic_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questions_subject_difficulty"
      ON "questions" ("subject_id", "difficulty")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questions_topic_difficulty"
      ON "questions" ("topic_id", "difficulty")
    `);

    // ── 1. Create streams table ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "streams" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "name"        character varying(100)   NOT NULL,
        "description" text,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_streams" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_streams_name" ON "streams" ("name")
    `);

    // ── 2. Add stream_id column to subjects if it doesn't exist ──────────────
    const streamIdExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'subjects'
        AND column_name  = 'stream_id'
    `);
    if (streamIdExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "subjects" ADD COLUMN "stream_id" uuid NULL
      `);
    }

    // ── 3. Add grade_id column to subjects if it doesn't exist ───────────────
    const gradeIdExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'subjects'
        AND column_name  = 'grade_id'
    `);
    if (gradeIdExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "subjects" ADD COLUMN "grade_id" uuid NULL
      `);
    }

    // ── 4. Drop the old NOT NULL constraint on grade_id if it exists ─────────
    // The old schema had grade_id NOT NULL. We need it nullable now.
    await queryRunner.query(
      `ALTER TABLE "subjects" ALTER COLUMN "grade_id" DROP NOT NULL`
    ).catch(() => { /* already nullable — ignore */ });

    // ── 5. Drop the old unique constraint (grade_id, name) if it exists ──────
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_subjects_grade_id_name"
    `);

    // ── 6. Drop any stale FK on stream_id (from failed previous deploys) ─────
    await queryRunner.query(`
      ALTER TABLE "subjects" DROP CONSTRAINT IF EXISTS "FK_e6ed9bf271d90965a038a5a0676"
    `);

    // ── 7. Clear orphaned stream_id values that point to nothing ─────────────
    // We do NOT add a FK constraint — stream_id is enforced at app layer only.
    // Just null out any stream_id values that don't match a real stream.
    await queryRunner.query(`
      UPDATE "subjects"
      SET "stream_id" = NULL
      WHERE "stream_id" IS NOT NULL
        AND "stream_id" NOT IN (SELECT "id" FROM "streams")
    `);

    // ── 8. Create index on stream_id ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subjects_stream_id" ON "subjects" ("stream_id")
    `);

    // ── 9. Create the new unique constraint (stream_id, name) ────────────────
    // Only add if it doesn't already exist
    const uqExists = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename  = 'subjects'
        AND indexname  = 'UQ_subjects_stream_id_name'
    `);
    if (uqExists.length === 0) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX "UQ_subjects_stream_id_name"
        ON "subjects" ("stream_id", "name")
        WHERE "stream_id" IS NOT NULL
      `);
    }

    // ── 10. Create question_explanations table ────────────────────────────────
    // questions table is guaranteed to exist from step 0d above.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_explanations" (
        "id"           uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "question_id"  uuid                     NOT NULL,
        "step_by_step" text                     NOT NULL,
        "clear"        text                     NOT NULL,
        "simplified"   text                     NOT NULL,
        "usage_count"  integer                  NOT NULL DEFAULT 0,
        "created_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_question_explanations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_question_explanations_question"
          FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_question_explanations_question_id"
      ON "question_explanations" ("question_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "question_explanations"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_stream_id_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subjects_stream_id"`);
    await queryRunner.query(`ALTER TABLE "subjects" DROP COLUMN IF EXISTS "stream_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "streams"`);
  }
}
