import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ensures Mathematics exists as two separate stream-specific subjects:
 *  - one row for Natural Science
 *  - one row for Social Science
 *
 * Mathematics is NOT a common subject — each stream has its own syllabus.
 * This migration fixes cases where the DB ended up with only one Mathematics
 * row (typically the Social Science one) because the Natural Science row was
 * missing or accidentally had stream_id = NULL and was deleted by the orphan
 * cleanup migration.
 *
 * It also removes any NULL-stream Mathematics row that may exist.
 */
export class FixMathematicsPerStream1700000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── 1. Get stream IDs ─────────────────────────────────────────────────
    const streams: { id: string; name: string }[] = await queryRunner.query(
      `SELECT id, name FROM streams WHERE name IN ('Natural Science', 'Social Science')`,
    );

    const naturalId = streams.find((s) => s.name === "Natural Science")?.id;
    const socialId  = streams.find((s) => s.name === "Social Science")?.id;

    if (!naturalId || !socialId) {
      console.log("  ▸ Streams not found — skipping Mathematics fix.");
      return;
    }

    // ── 2. Remove any NULL-stream Mathematics (should not exist) ─────────
    const nullRows: { id: string }[] = await queryRunner.query(
      `SELECT id FROM subjects WHERE name = 'Mathematics' AND stream_id IS NULL`,
    );

    if (nullRows.length > 0) {
      console.log(`  ▸ Removing ${nullRows.length} NULL-stream Mathematics row(s)...`);
      // Reassign topics/questions to the Natural Science Mathematics before deleting
      const naturalMathRows: { id: string }[] = await queryRunner.query(
        `SELECT id FROM subjects WHERE name = 'Mathematics' AND stream_id = $1`,
        [naturalId],
      );
      const naturalMathId = naturalMathRows[0]?.id;

      for (const row of nullRows) {
        if (naturalMathId) {
          // Re-point topics
          await queryRunner.query(
            `UPDATE topics SET subject_id = $1
             WHERE subject_id = $2
               AND NOT EXISTS (
                 SELECT 1 FROM topics t2
                 WHERE t2.subject_id = $1 AND t2.name = topics.name
               )`,
            [naturalMathId, row.id],
          );
          await queryRunner.query(`DELETE FROM topics WHERE subject_id = $1`, [row.id]);
          // Re-point questions
          await queryRunner.query(
            `UPDATE questions SET subject_id = $1 WHERE subject_id = $2`,
            [naturalMathId, row.id],
          );
          // Re-point mock exams
          await queryRunner.query(
            `UPDATE mock_exams SET subject_id = $1 WHERE subject_id = $2`
              .replace("UPDATE mock_exams", `UPDATE mock_exams`),
            [naturalMathId, row.id],
          ).catch(() => { /* mock_exams may not exist */ });
        }
        await queryRunner.query(`DELETE FROM subjects WHERE id = $1`, [row.id]);
      }
      console.log(`  ▸ Removed NULL-stream Mathematics row(s).`);
    }

    // ── 3. Ensure Natural Science Mathematics exists ──────────────────────
    const naturalMath: { id: string }[] = await queryRunner.query(
      `SELECT id FROM subjects WHERE name = 'Mathematics' AND stream_id = $1`,
      [naturalId],
    );
    if (naturalMath.length === 0) {
      await queryRunner.query(
        `INSERT INTO subjects (id, name, stream_id, grade_id, description, created_at, updated_at)
         VALUES (uuid_generate_v4(), 'Mathematics', $1, NULL, NULL, now(), now())`,
        [naturalId],
      );
      console.log("  ▸ Created Mathematics for Natural Science.");
    } else {
      console.log("  · Mathematics (Natural Science) already exists.");
    }

    // ── 4. Ensure Social Science Mathematics exists ───────────────────────
    const socialMath: { id: string }[] = await queryRunner.query(
      `SELECT id FROM subjects WHERE name = 'Mathematics' AND stream_id = $1`,
      [socialId],
    );
    if (socialMath.length === 0) {
      await queryRunner.query(
        `INSERT INTO subjects (id, name, stream_id, grade_id, description, created_at, updated_at)
         VALUES (uuid_generate_v4(), 'Mathematics', $1, NULL, NULL, now(), now())`,
        [socialId],
      );
      console.log("  ▸ Created Mathematics for Social Science.");
    } else {
      console.log("  · Mathematics (Social Science) already exists.");
    }

    console.log("  ▸ Mathematics per-stream fix complete.");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.warn("  ⚠ FixMathematicsPerStream migration cannot be automatically reverted.");
  }
}
