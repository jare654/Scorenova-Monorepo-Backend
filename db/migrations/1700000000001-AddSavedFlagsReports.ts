import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSavedFlagsReports1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: ensure uuid-ossp is available ─────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Guard: ensure accounts table exists (fresh DB) ───────────────────────
    // This is a minimal skeleton. TypeORM synchronize / subsequent migrations
    // will add the remaining columns on first run in dev, or they already exist
    // in production. The FK references only need the PK to be present.
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

    // ── Guard: ensure questions table exists (fresh DB) ──────────────────────
    // Minimal skeleton — the real schema is created by migration 0 or synchronize.
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
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "topics" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "subject_id"  uuid                     NOT NULL,
        "name"        character varying(255)   NOT NULL,
        "description" text,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_topics" PRIMARY KEY ("id"),
        CONSTRAINT "FK_topics_subject_m1"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE
      )
    `);
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
        CONSTRAINT "FK_questions_subject_m1"
          FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_questions_topic_m1"
          FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL
      )
    `);

    // ── saved_questions ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_questions" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "account_id"  uuid                     NOT NULL,
        "question_id" uuid                     NOT NULL,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_questions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_questions_account_question"
          UNIQUE ("account_id", "question_id"),
        CONSTRAINT "FK_saved_questions_account"
          FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_saved_questions_question"
          FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_saved_questions_account_id"
      ON "saved_questions" ("account_id")
    `);

    // ── question_flags ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "question_flags" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "account_id"  uuid                     NOT NULL,
        "question_id" uuid                     NOT NULL,
        "reason"      character varying(500)   NOT NULL,
        "status"      character varying(20)    NOT NULL DEFAULT 'pending',
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_question_flags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_question_flags_account_question"
          UNIQUE ("account_id", "question_id"),
        CONSTRAINT "FK_question_flags_account"
          FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_question_flags_question"
          FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_flags_question_id"
      ON "question_flags" ("question_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_question_flags_status"
      ON "question_flags" ("status")
    `);

    // ── user_reports ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_reports" (
        "id"          uuid                     NOT NULL DEFAULT uuid_generate_v4(),
        "account_id"  uuid                     NOT NULL,
        "type"        character varying(50)    NOT NULL DEFAULT 'bug',
        "description" text                     NOT NULL,
        "question_id" uuid,
        "status"      character varying(20)    NOT NULL DEFAULT 'open',
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_reports_account"
          FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_reports_question"
          FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_reports_status"
      ON "user_reports" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_reports_type"
      ON "user_reports" ("type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question_flags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_questions"`);
  }
}
