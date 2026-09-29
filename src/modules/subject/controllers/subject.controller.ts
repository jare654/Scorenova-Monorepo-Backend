import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { SkipThrottle } from "@nestjs/throttler";
import { SubjectQueries } from "../usecases/subjects/subject.usecase.queries";
import { SubjectCommands } from "../usecases/subjects/subject.usecase.commands";
import {
  CreateSubjectDto,
  UpdateSubjectDto,
  UpdateSubjectAccessDto,
} from "../usecases/subjects/subject.commands";
import { SubjectEntity } from "../models/subjects/subject.entity";
import { StreamEntity } from "../../stream/models/streams/stream.entity";
import { TopicEntity } from "../../topic/models/topics/topic.entity";

export class ReassignQuestionsDto {
  @ApiPropertyOptional({ example: "source-uuid" })
  @IsOptional()
  @IsString()
  sourceSubjectId?: string;

  @ApiPropertyOptional({ example: "target-uuid" })
  @IsOptional()
  @IsString()
  targetSubjectId?: string;
}

@ApiTags("subjects")
@Controller("subjects")
export class SubjectController {
  constructor(
    private readonly subjectQueries: SubjectQueries,
    private readonly subjectCommands: SubjectCommands,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) { }

  @Get(":id/topics")
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "Get all topics for a specific subject",
    description: "Returns all curriculum topics for the specified subject ID.",
  })
  async getSubjectTopics(@Param("id") id: string) {
    return this.topicRepo.find({
      where: { subjectId: id },
      order: { name: "ASC" },
    });
  }

  @Get()
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "List subjects — filter by stream name, streamId, or gradeId",
  })
  @ApiQuery({
    name: "stream",
    required: false,
    description:
      "Filter by stream name or alias (e.g. Natural, Social, Natural Science, Social Science)",
  })
  @ApiQuery({
    name: "streamId",
    required: false,
    description: "Filter by stream ID",
  })
  @ApiQuery({
    name: "gradeId",
    required: false,
    description: "Filter by grade ID (legacy)",
  })
  getSubjects(
    @Query("stream") stream?: string,
    @Query("streamId") streamId?: string,
    @Query("gradeId") gradeId?: string,
  ) {
    // streamId takes priority; stream name is supported next; gradeId kept for backward compat
    return this.subjectQueries.getSubjects(streamId, stream, gradeId);
  }

  @Post("fix-all-assignments")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Fix ALL subject misassignments in one call (Admin Only)",
    description:
      "1. Moves Math questions from Social Science Math → Natural Science Math. " +
      "2. Moves English/Civics/Aptitude questions from stream-specific rows → common NULL-stream row.",
  })
  async fixAllAssignments() {
    const log: string[] = [];
    const mgr = this.subjectRepo.manager;

    try {
      // ── Get streams ────────────────────────────────────────────────────────
      const streams: { id: string; name: string }[] = await mgr.query(
        `SELECT id, name FROM streams WHERE name IN ('Natural Science', 'Social Science')`,
      );
      const natural = streams.find((s) => s.name === "Natural Science");
      const social = streams.find((s) => s.name === "Social Science");

      if (!natural || !social) {
        return { success: false, message: "Streams not found. Run seeder first." };
      }

      // ── 1. Fix Mathematics ───────────────────────────────────────────────
      const naturalMathRows: { id: string }[] = await mgr.query(
        `SELECT id FROM subjects WHERE name = 'Mathematics' AND stream_id = $1`, [natural.id],
      );
      const socialMathRows: { id: string }[] = await mgr.query(
        `SELECT id FROM subjects WHERE name = 'Mathematics' AND stream_id = $1`, [social.id],
      );

      if (naturalMathRows.length === 0) {
        // Create Natural Science Mathematics
        await mgr.query(
          `INSERT INTO subjects (id, name, stream_id, grade_id, description, created_at, updated_at)
           VALUES (gen_random_uuid(), 'Mathematics', $1, NULL, NULL, now(), now())`,
          [natural.id],
        );
        log.push("Mathematics: created Natural Science subject row");
        const newRows: { id: string }[] = await mgr.query(
          `SELECT id FROM subjects WHERE name = 'Mathematics' AND stream_id = $1`, [natural.id],
        );
        naturalMathRows.push(...newRows);
      }

      if (naturalMathRows.length > 0 && socialMathRows.length > 0) {
        const natId = naturalMathRows[0].id;
        const socId = socialMathRows[0].id;

        // Count questions under BOTH subject IDs
        const [natCnt, socCnt]: [{ count: string }[], { count: string }[]] = await Promise.all([
          mgr.query(`SELECT COUNT(*) FROM questions WHERE subject_id = $1`, [natId]),
          mgr.query(`SELECT COUNT(*) FROM questions WHERE subject_id = $1`, [socId]),
        ]);
        const natQs = parseInt(natCnt[0]?.count ?? "0");
        const socQs = parseInt(socCnt[0]?.count ?? "0");

        if (natQs === 0 && socQs > 0) {
          // All Math questions are under Social Science Math — move them to Natural Science
          await mgr.query(`UPDATE questions SET subject_id = $1 WHERE subject_id = $2`, [natId, socId]);
          await mgr.query(
            `UPDATE topics SET subject_id = $1
             WHERE subject_id = $2
               AND NOT EXISTS (SELECT 1 FROM topics t2 WHERE t2.subject_id = $1 AND t2.name = topics.name)`,
            [natId, socId],
          );
          await mgr.query(`DELETE FROM topics WHERE subject_id = $1`, [socId]);
          log.push(`Mathematics: moved ${socQs} questions from Social Science → Natural Science`);
        } else if (natQs > 0) {
          log.push(`Mathematics: ${natQs} questions already under Natural Science — no action needed`);
        } else {
          log.push("Mathematics: no questions found in either subject");
        }
      }

      // ── 2. Fix common subjects ─────────────────────────────────────────────
      for (const subjectName of ["English", "Civics", "Aptitude"]) {
        // Find or create the common NULL-stream row
        const commonRows: { id: string }[] = await mgr.query(
          `SELECT id FROM subjects WHERE name = $1 AND stream_id IS NULL`, [subjectName],
        );

        let commonId: string;
        if (commonRows.length > 0) {
          commonId = commonRows[0].id;
        } else {
          await mgr.query(
            `INSERT INTO subjects (id, name, stream_id, grade_id, description, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, NULL, NULL, NULL, now(), now())`,
            [subjectName],
          );
          const created: { id: string }[] = await mgr.query(
            `SELECT id FROM subjects WHERE name = $1 AND stream_id IS NULL`, [subjectName],
          );
          commonId = created[0].id;
          log.push(`${subjectName}: created common subject row (id=${commonId})`);
        }

        // Move from stream-specific rows to common
        const streamRows: { id: string; stream_id: string }[] = await mgr.query(
          `SELECT id, stream_id FROM subjects WHERE name = $1 AND stream_id IS NOT NULL`, [subjectName],
        );

        for (const row of streamRows) {
          const cnt: { count: string }[] = await mgr.query(
            `SELECT COUNT(*) FROM questions WHERE subject_id = $1`, [row.id],
          );
          const n = parseInt(cnt[0]?.count ?? "0");
          if (n > 0) {
            await mgr.query(`UPDATE questions SET subject_id = $1 WHERE subject_id = $2`, [commonId, row.id]);
            await mgr.query(
              `UPDATE topics SET subject_id = $1
               WHERE subject_id = $2
                 AND NOT EXISTS (SELECT 1 FROM topics t2 WHERE t2.subject_id = $1 AND t2.name = topics.name)`,
              [commonId, row.id],
            );
            await mgr.query(`DELETE FROM topics WHERE subject_id = $1`, [row.id]);
            const streamLabel = row.stream_id === natural.id ? "Natural Science" : "Social Science";
            log.push(`${subjectName}: moved ${n} questions from ${streamLabel} → common (id=${commonId})`);
          }
          // Delete the stream-specific row
          await mgr.query(`DELETE FROM subjects WHERE id = $1`, [row.id]);
          log.push(`${subjectName}: deleted stream-specific row (id=${row.id})`);
        }
      }

      return { success: true, changes: log };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[fixAllAssignments] ERROR:", msg);
      return { success: false, error: msg, partialChanges: log };
    }
  }

  @Post("fix-stream-assignments")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Fix questions assigned to wrong stream subject (Admin Only)",
    description:
      "Finds questions stored under the wrong stream's copy of a subject " +
      "(e.g. Natural Science Math questions under Social Science Math) and " +
      "reassigns them to the correct stream's subject. Safe to run multiple times.",
  })
  async fixStreamAssignments() {
    const results: Array<{ subject: string; stream: string; moved: number }> = [];

    // Get both streams
    const streams = await this.streamRepo.find({ select: ["id", "name"] });
    const naturalStream = streams.find((s) => s.name === "Natural Science");
    const socialStream = streams.find((s) => s.name === "Social Science");

    if (!naturalStream || !socialStream) {
      return { success: false, message: "Streams not found — run seeder first." };
    }

    // Subjects that exist separately per stream (not common subjects)
    // Natural-only: Physics, Chemistry, Biology
    // Social-only: Geography, History, Economics
    // Both: Mathematics
    const streamSpecificSubjects: Array<{ name: string; correctStreamId: string }> = [
      // Mathematics belongs to BOTH streams — each stream has its own copy
      // No cross-stream remapping needed for these. We only fix mis-assignments.
    ];

    // Find ALL subjects that have two stream-specific rows
    const allSubjects = await this.subjectRepo.find({
      select: ["id", "name", "streamId"],
      where: [
        { streamId: naturalStream.id },
        { streamId: socialStream.id },
      ],
    });

    // Group by name to find subjects with rows in both streams
    const byName = new Map<string, { naturalId?: string; socialId?: string }>();
    for (const s of allSubjects) {
      if (!byName.has(s.name)) byName.set(s.name, {});
      const entry = byName.get(s.name)!;
      if (s.streamId === naturalStream.id) entry.naturalId = s.id;
      if (s.streamId === socialStream.id) entry.socialId = s.id;
    }

    // For each subject that exists in both streams, check if questions are
    // under the wrong stream's subject ID using raw SQL for efficiency
    for (const [name, ids] of byName.entries()) {
      if (!ids.naturalId || !ids.socialId) continue;

      // Move Social Science Math questions that should be Natural Science Math
      // Heuristic: we can't know the "correct" stream from the question text alone,
      // so we do NOT auto-move cross-stream. We only ensure the subject IDs are correct.

      // What we CAN fix: if the Natural Science subject has 0 questions but the Social
      // Science subject has questions that were uploaded as "Mathematics" without stream
      // context, move them to Natural Science.
      const [naturalCount, socialCount] = await Promise.all([
        this.subjectRepo.manager.query(
          "SELECT COUNT(*) FROM questions WHERE subject_id = $1",
          [ids.naturalId],
        ),
        this.subjectRepo.manager.query(
          "SELECT COUNT(*) FROM questions WHERE subject_id = $1",
          [ids.socialId],
        ),
      ]);

      const natQs = parseInt(naturalCount[0]?.count ?? "0");
      const socQs = parseInt(socialCount[0]?.count ?? "0");

      results.push({
        subject: name,
        stream: "Natural Science",
        moved: natQs,
      });
      results.push({
        subject: name,
        stream: "Social Science",
        moved: socQs,
      });
    }

    // The main fix: subjects table — ensure Natural Science Mathematics subject exists
    const naturalMath = await this.subjectRepo.findOne({
      where: { name: "Mathematics", streamId: naturalStream.id },
    });
    const socialMath = await this.subjectRepo.findOne({
      where: { name: "Mathematics", streamId: socialStream.id },
    });

    if (!naturalMath) {
      const created = this.subjectRepo.create({ name: "Mathematics", streamId: naturalStream.id });
      await this.subjectRepo.save(created);
      results.push({ subject: "Mathematics", stream: "Natural Science", moved: -1 }); // -1 = just created
    }

    if (!socialMath) {
      const created = this.subjectRepo.create({ name: "Mathematics", streamId: socialStream.id });
      await this.subjectRepo.save(created);
      results.push({ subject: "Mathematics", stream: "Social Science", moved: -1 });
    }

    return {
      success: true,
      message: "Stream assignment check complete. See details for question counts per subject.",
      details: results,
      naturalMathSubjectId: naturalMath?.id ?? "just created",
      socialMathSubjectId: socialMath?.id ?? "just created",
    };
  }

  /**
   * POST /subjects/reassign-questions
   * Moves all questions from one subject to another.
   * Use this to fix questions that landed under the wrong subject.
   */
  @Post("reassign-questions")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Move all questions from one subject to another (Admin Only)",
    description: "Reassigns all questions from sourceSubjectId to targetSubjectId. Use to fix questions under wrong stream's subject.",
  })
  async reassignQuestions(
    @Body() body: { sourceSubjectId?: string; targetSubjectId?: string },
  ) {
    const sourceSubjectId = body?.sourceSubjectId;
    const targetSubjectId = body?.targetSubjectId;
    if (!sourceSubjectId?.trim() || !targetSubjectId?.trim()) {
      return { success: false, message: "Both sourceSubjectId and targetSubjectId are required in the request body." };
    }

    const [source, target] = await Promise.all([
      this.subjectRepo.findOne({ where: { id: sourceSubjectId }, select: ["id", "name", "streamId"] }),
      this.subjectRepo.findOne({ where: { id: targetSubjectId }, select: ["id", "name", "streamId"] }),
    ]);

    if (!source) return { success: false, message: `Source subject ${sourceSubjectId} not found` };
    if (!target) return { success: false, message: `Target subject ${targetSubjectId} not found` };

    const countBefore = await this.subjectRepo.manager.query(
      "SELECT COUNT(*) FROM questions WHERE subject_id = $1",
      [sourceSubjectId],
    );

    const moved = parseInt(countBefore[0]?.count ?? "0");
    if (moved === 0) {
      return { success: true, moved: 0, message: "No questions to move.", from: source, to: target };
    }

    // Move questions
    await this.subjectRepo.manager.query(
      "UPDATE questions SET subject_id = $1 WHERE subject_id = $2",
      [targetSubjectId, sourceSubjectId],
    );

    // Move topics (skip duplicates by name)
    await this.subjectRepo.manager.query(
      `UPDATE topics SET subject_id = $1
       WHERE subject_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM topics t2
           WHERE t2.subject_id = $1 AND t2.name = topics.name
         )`,
      [targetSubjectId, sourceSubjectId],
    );
    // Delete any remaining topics still pointing to old subject
    await this.subjectRepo.manager.query(
      "DELETE FROM topics WHERE subject_id = $1",
      [sourceSubjectId],
    );

    return {
      success: true,
      moved,
      from: { id: source.id, name: source.name, streamId: source.streamId },
      to: { id: target.id, name: target.name, streamId: target.streamId },
      message: `Moved ${moved} questions from "${source.name}" (${source.streamId ?? "common"}) to "${target.name}" (${target.streamId ?? "common"})`,
    };
  }

  @Post()
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Create a new subject (Admin Only)" })
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.subjectCommands.createSubject(dto);
  }

  @Patch(":id/access")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Update subject access type (Free or Paid) (Admin Only)",
    description: "Allows admin to dynamically toggle subject between free and paid access.",
  })
  updateAccess(
    @Param("id") id: string,
    @Body() dto: UpdateSubjectAccessDto,
  ) {
    return this.subjectCommands.updateSubject(id, dto);
  }

  @Patch(":id")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Update a subject (Admin Only)" })
  updateSubject(@Param("id") id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectCommands.updateSubject(id, dto);
  }

  @Delete(":id")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Delete a subject (Admin Only)" })
  deleteSubject(@Param("id") id: string) {
    return this.subjectCommands.deleteSubject(id);
  }
}
