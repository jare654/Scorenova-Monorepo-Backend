import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Removes subjects that have no stream_id (legacy grade-based subjects).
 * These were created before the stream architecture was introduced.
 *
 * CASCADE: questions linked to these subjects will also be deleted
 * because questions.subject_id has ON DELETE CASCADE.
 * Topics linked to these subjects will also be deleted
 * because topics.subject_id has ON DELETE CASCADE.
 *
 * NOTE: Intentional common subjects (English, Civics, Aptitude) that have
 * stream_id = NULL are preserved — only truly orphaned legacy subjects are removed.
 *
 * This migration is safe to run multiple times (idempotent).
 */
export class CleanupOrphanSubjects1700000000003 implements MigrationInterface {
  // These subjects are intentionally common (stream_id = NULL) — never delete them.
  private readonly KEEP_COMMON = ["English", "Civics", "Aptitude"];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Guard: skip entirely if subjects table doesn't exist yet ────────────
    const subjectsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'subjects'
    `);
    if (subjectsExists.length === 0) {
      console.log("  ▸ subjects table does not exist — skipping orphan cleanup.");
      return;
    }

    // ── Guard: skip if stream_id column doesn't exist yet ───────────────────
    const streamIdColExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'subjects'
        AND column_name  = 'stream_id'
    `);
    if (streamIdColExists.length === 0) {
      console.log("  ▸ subjects.stream_id column does not exist — skipping orphan cleanup.");
      return;
    }

    // Build a safe exclusion list for intentional common subjects
    const keepList = this.KEEP_COMMON.map((n) => `'${n}'`).join(", ");

    // Count before deletion for logging (excluding intentional commons)
    const countResult = await queryRunner.query(`
      SELECT COUNT(*)::int AS count FROM "subjects"
      WHERE "stream_id" IS NULL
        AND "name" NOT IN (${keepList})
    `);
    const orphanCount = countResult[0]?.count ?? 0;

    if (orphanCount === 0) {
      console.log("  ▸ No orphan subjects found — skipping cleanup.");
      return;
    }

    console.log(`  ▸ Deleting ${orphanCount} subjects with no stream_id (excluding intentional commons)...`);

    // Check if topics table exists before attempting deletion
    const topicsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'topics'
    `);
    if (topicsExists.length > 0) {
      await queryRunner.query(`
        DELETE FROM "topics"
        WHERE "subject_id" IN (
          SELECT "id" FROM "subjects"
          WHERE "stream_id" IS NULL
            AND "name" NOT IN (${keepList})
        )
      `);
    }

    // Check if questions table exists before attempting deletion
    const questionsExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'questions'
    `);
    if (questionsExists.length > 0) {
      await queryRunner.query(`
        DELETE FROM "questions"
        WHERE "subject_id" IN (
          SELECT "id" FROM "subjects"
          WHERE "stream_id" IS NULL
            AND "name" NOT IN (${keepList})
        )
      `);
    }

    // Delete the orphan subjects themselves (preserving intentional commons)
    await queryRunner.query(`
      DELETE FROM "subjects"
      WHERE "stream_id" IS NULL
        AND "name" NOT IN (${keepList})
    `);

    console.log(`  ▸ Cleanup complete. Removed ${orphanCount} orphan subjects.`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot restore deleted data — this migration is irreversible.
    console.warn("  ⚠ CleanupOrphanSubjects migration cannot be reverted.");
  }
}
