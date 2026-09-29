import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migrates English, Civics, and Aptitude from stream-specific subjects
 * (one row per stream) to a single common subject row with stream_id = NULL.
 *
 * This ensures these subjects are visible to students from both streams
 * without duplication.
 *
 * Steps:
 *  1. For each common subject, find or create a NULL-stream row.
 *  2. Re-point all topics and questions from the old stream-specific rows
 *     to the single common row.
 *  3. Delete the old stream-specific rows.
 */
export class MigrateCommonSubjects1700000000008 implements MigrationInterface {
  private readonly COMMON_SUBJECT_NAMES = ["English", "Civics", "Aptitude"];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    for (const name of this.COMMON_SUBJECT_NAMES) {
      console.log(`  ▸ Migrating common subject: ${name}`);

      // ── 1. Find all stream-specific rows for this subject ──────────────────
      const streamRows: { id: string }[] = await queryRunner.query(
        `SELECT id FROM subjects WHERE name = $1 AND stream_id IS NOT NULL`,
        [name],
      );

      if (streamRows.length === 0) {
        console.log(`    · No stream-specific rows found for "${name}" — skipping`);
        continue;
      }

      // ── 2. Find or create the common (NULL-stream) row ────────────────────
      const commonRows: { id: string }[] = await queryRunner.query(
        `SELECT id FROM subjects WHERE name = $1 AND stream_id IS NULL`,
        [name],
      );

      let commonId: string;
      if (commonRows.length > 0) {
        commonId = commonRows[0].id;
        console.log(`    · Common row already exists for "${name}" (id=${commonId})`);
      } else {
        const inserted: { id: string }[] = await queryRunner.query(
          `INSERT INTO subjects (id, name, stream_id, grade_id, description, created_at, updated_at)
           VALUES (uuid_generate_v4(), $1, NULL, NULL, NULL, now(), now())
           RETURNING id`,
          [name],
        );
        commonId = inserted[0].id;
        console.log(`    ✓ Created common row for "${name}" (id=${commonId})`);
      }

      const streamIds = streamRows.map((r) => r.id);

      // ── 3. Re-point topics → common subject ──────────────────────────────
      // Guard: check topics table exists
      const topicsExist: { exists: boolean }[] = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'topics'
        ) AS exists
      `);
      if (topicsExist[0]?.exists) {
        for (const oldId of streamIds) {
          await queryRunner.query(
            `UPDATE topics SET subject_id = $1
             WHERE subject_id = $2
               AND NOT EXISTS (
                 SELECT 1 FROM topics t2
                 WHERE t2.subject_id = $1 AND t2.name = topics.name
               )`,
            [commonId, oldId],
          );
          // Delete any remaining topics that would duplicate a common one
          await queryRunner.query(
            `DELETE FROM topics WHERE subject_id = $1`,
            [oldId],
          );
        }
        console.log(`    ✓ Re-pointed topics for "${name}"`);
      }

      // ── 4. Re-point questions → common subject ────────────────────────────
      const questionsExist: { exists: boolean }[] = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'questions'
        ) AS exists
      `);
      if (questionsExist[0]?.exists) {
        for (const oldId of streamIds) {
          await queryRunner.query(
            `UPDATE questions SET subject_id = $1 WHERE subject_id = $2`,
            [commonId, oldId],
          );
        }
        console.log(`    ✓ Re-pointed questions for "${name}"`);
      }

      // ── 5. Re-point mock_exam subjects ────────────────────────────────────
      const mockExamsExist: { exists: boolean }[] = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'mock_exams'
        ) AS exists
      `);
      if (mockExamsExist[0]?.exists) {
        for (const oldId of streamIds) {
          await queryRunner.query(
            `UPDATE mock_exams SET subject_id = $1 WHERE subject_id = $2`,
            [commonId, oldId],
          );
        }
        console.log(`    ✓ Re-pointed mock_exams for "${name}"`);
      }

      // ── 6. Re-point mock_exam_results subjects ────────────────────────────
      const mockResultsExist: { exists: boolean }[] = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'mock_exam_results'
        ) AS exists
      `);
      if (mockResultsExist[0]?.exists) {
        for (const oldId of streamIds) {
          await queryRunner.query(
            `UPDATE mock_exam_results SET subject_id = $1 WHERE subject_id = $2`,
            [commonId, oldId],
          );
        }
        console.log(`    ✓ Re-pointed mock_exam_results for "${name}"`);
      }

      // ── 7. Delete the old stream-specific rows ────────────────────────────
      for (const oldId of streamIds) {
        await queryRunner.query(
          `DELETE FROM subjects WHERE id = $1`,
          [oldId],
        );
      }
      console.log(`    ✓ Deleted ${streamIds.length} stream-specific row(s) for "${name}"`);
    }

    console.log("  ▸ Common subjects migration complete.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down migration: not easily reversible without knowing the original stream
    // assignments. Log a warning instead.
    console.warn(
      "MigrateCommonSubjects.down(): This migration cannot be automatically reversed. " +
      "Re-run the curriculum seeder with FORCE_RESEED=true to restore the original state.",
    );
  }
}
