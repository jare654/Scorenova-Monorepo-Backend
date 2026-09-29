import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { SkipThrottle } from "@nestjs/throttler";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";
import { StreamEntity } from "../../stream/models/streams/stream.entity";
import { AccountEntity } from "../../account/models/accounts/account.entity";
import { CreateExamSessionUsecase } from "../../attempt/usecases/attempts/create-exam-session.usecase";
import { RecordAttemptsBatchUsecase } from "../../attempt/usecases/attempts/record-attempts-batch.usecase";
import { MockExamEntity } from "../models/mock-exam.entity";
import { MockExamResultEntity } from "../models/mock-exam-result.entity";
import { MockExplanationEntity } from "../models/mock-explanation.entity";
import { GenerateMockExamUsecase } from "../usecases/generate-mock-exam.usecase";
import { MockExplanationService } from "../services/mock-explanation.service";
import { SettingsService } from "../../settings/settings.service";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export class UpdateMockExamDto {
  @ApiPropertyOptional({ example: "Mock Exam 1 - Revision" })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ example: 60, description: "Exam duration in minutes" })
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ description: "Whether exam is free for all users", example: true })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "free", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

export class UpdateMockExamAccessDto {
  @ApiPropertyOptional({ description: "Whether exam is free for all users", example: true })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "free", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

export class GenerateMockExamDto {
  @ApiPropertyOptional({ description: "Topic ID to generate exam for (if provided, subjectId is derived automatically)", example: "5694aadc-de3f-4b4a-9f06-62e0a9a42dad" })
  @IsUUID()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional({ description: "Subject ID to generate exam for (optional if topicId is provided)", example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiProperty({ description: "Number of questions (5–100)", example: 50 })
  @IsInt()
  @Min(5)
  @Max(100)
  questionCount: number;
}

export class MockAnswerDto {
  @ApiProperty({
    description: "Question index (0-based) in the exam's questions array",
    example: 0,
  })
  @IsInt()
  @Min(0)
  questionIndex: number;

  @ApiProperty({ description: "Selected answer letter: A, B, C, or D", example: "A" })
  @IsString()
  @IsNotEmpty()
  selectedAnswer: string;

  @ApiProperty({ description: "Time spent on this question in milliseconds", example: 35000 })
  @IsInt()
  @Min(0)
  timeSpentMs: number;
}

export class SubmitMockExamDto {
  @ApiProperty({ description: "ID of the exam being submitted", example: "m0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99" })
  @IsString()
  @IsNotEmpty()
  examId: string;

  @ApiProperty({ type: [MockAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MockAnswerDto)
  answers: MockAnswerDto[];
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags("mocks")
@Controller("mocks")
@SkipThrottle()
@ApiBearerAuth("Bearer")
export class MockController {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(MockExamEntity)
    private readonly mockExamRepo: Repository<MockExamEntity>,
    @InjectRepository(MockExamResultEntity)
    private readonly resultRepo: Repository<MockExamResultEntity>,
    private readonly generateUsecase: GenerateMockExamUsecase,
    private readonly createSessionUsecase: CreateExamSessionUsecase,
    private readonly recordBatchUsecase: RecordAttemptsBatchUsecase,
    private readonly mockExplanationService: MockExplanationService,
    private readonly settingsService: SettingsService,
  ) {}

  private async resolveStreamId(stream: string): Promise<string | null> {
    if (!stream?.trim()) return null;
    const val = stream.trim();

    // 1. Check known legacy UUIDs
    const legacyMap: Record<string, string> = {
      "5d24102f-a070-4c18-b612-fa070447f158": "Natural Science",
      "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22": "Natural Science",
      "c891ef18-1d77-4861-9bbc-186b4bc96c23": "Social Science",
      "cleebc99-9c0b-4ef8-bb6d-6bb9bd380a33": "Social Science",
    };
    if (legacyMap[val.toLowerCase()]) {
      const entity = await this.streamRepo.findOne({
        where: { name: ILike(legacyMap[val.toLowerCase()]) },
      });
      if (entity) return entity.id;
    }

    // 2. Check if val is already a valid stream UUID in the DB
    try {
      const streamById = await this.streamRepo.findOne({ where: { id: val } });
      if (streamById) return streamById.id;
    } catch (_) {}

    // 3. Normalize name and find by name
    const normalized = this.normalizeStreamName(val);
    const streamEntity = await this.streamRepo.findOne({
      where: { name: ILike(normalized) },
    });
    return streamEntity?.id ?? null;
  }

  private normalizeStreamName(value: string): string {
    const cleaned = value.trim().toLowerCase();
    if (cleaned === "social" || cleaned === "social science") {
      return "Social Science";
    }
    if (cleaned === "natural" || cleaned === "natural science") {
      return "Natural Science";
    }
    return value;
  }

  /** Read freeSubjectId from settings — fast JSONB lookup. */
  private async _getFreeSubjectId(): Promise<string | null> {
    try {
      const s = await this.settingsService.getSection("premium");
      return (s?.data?.freeSubjectId as string) ?? null;
    } catch {
      return null;
    }
  }

  // ── Admin: Generate a new mock exam via Mistral AI ─────────────────────────

  @Post("generate")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Generate a new AI mock exam (Admin Only)",
    description:
      "Calls Mistral AI to generate EUEE-style questions for the given subject or topic. " +
      "If topicId is provided, subjectId is automatically resolved from the topic record. " +
      "Saves as Mock Exam N (auto-incremented). Avoids duplicating existing questions.",
  })
  async generateMockExam(
    @Body() dto: GenerateMockExamDto,
  ): Promise<MockExamEntity> {
    if (!dto.topicId?.trim() && !dto.subjectId?.trim()) {
      throw new BadRequestException("Either topicId or subjectId must be provided.");
    }
    return this.generateUsecase.run(dto.subjectId, dto.questionCount, dto.topicId);
  }

  // ── Admin: List all mock exams for a subject ───────────────────────────────

  @Get("admin/list")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({ summary: "List all mock exams per subject (Admin Only)" })
  @ApiQuery({ name: "subjectId", required: false, type: String })
  async listMockExams(
    @Query("subjectId") subjectId?: string,
  ): Promise<any[]> {
    const qb = this.mockExamRepo
      .createQueryBuilder("m")
      .select([
        "m.id",
        "m.subjectId",
        "m.label",
        "m.questionCount",
        "m.durationMinutes",
        "m.status",
        "m.errorMessage",
        "m.isFree",
        "m.accessType",
        "m.createdAt",
        "m.updatedAt",
      ])
      .orderBy("m.createdAt", "DESC");

    if (subjectId?.trim()) {
      qb.where("m.subjectId = :subjectId", { subjectId });
    }

    const exams = await qb.getMany();
    return exams.map((e) => {
      const duration = e.durationMinutes ?? Math.ceil((e.questionCount || 0) * 1.5);
      return {
        ...e,
        durationMinutes: duration,
      };
    });
  }

  // ── Admin: List all mock exam results with student info ────────────────────
  // NOTE: must be declared BEFORE admin/:id to avoid NestJS treating "results" as :id

  @Get("admin/results")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "List all mock exam results with student info (Admin Only)",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "subjectId", required: false, type: String })
  async getMockResults(
    @Query("page") pageStr?: string,
    @Query("limit") limitStr?: string,
    @Query("subjectId") subjectId?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitStr ?? "20", 10) || 20),
    );
    const skip = (page - 1) * limit;

    const qb = this.resultRepo
      .createQueryBuilder("r")
      .select([
        "r.id",
        "r.examId",
        "r.accountId",
        "r.subjectId",
        "r.sessionId",
        "r.totalQuestions",
        "r.correctAnswers",
        "r.scorePercent",
        "r.passed",
        "r.takenAt",
      ])
      .orderBy("r.takenAt", "DESC")
      .skip(skip)
      .take(limit);

    if (subjectId?.trim()) {
      qb.where("r.subjectId = :subjectId", { subjectId });
    }

    const [results, total] = await qb.getManyAndCount();

    if (results.length === 0) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const accountIds = [...new Set(results.map((r) => r.accountId))];
    const subjectIds = [...new Set(results.map((r) => r.subjectId))];
    const examIds = [...new Set(results.map((r) => r.examId))];

    const [accounts, subjects, exams] = await Promise.all([
      this.accountRepo
        .createQueryBuilder("a")
        .select(["a.id", "a.name", "a.phoneNumber"])
        .where("a.id IN (:...ids)", { ids: accountIds })
        .getMany(),
      this.subjectRepo
        .createQueryBuilder("s")
        .select(["s.id", "s.name"])
        .where("s.id IN (:...ids)", { ids: subjectIds })
        .getMany(),
      this.mockExamRepo
        .createQueryBuilder("m")
        .select(["m.id", "m.label"])
        .where("m.id IN (:...ids)", { ids: examIds })
        .getMany(),
    ]);

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const examMap = new Map(exams.map((e) => [e.id, e]));

    const data = results.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      examId: r.examId,
      examLabel: examMap.get(r.examId)?.label ?? "—",
      studentName: accountMap.get(r.accountId)?.name ?? "Unknown",
      studentPhone: accountMap.get(r.accountId)?.phoneNumber ?? "—",
      subjectId: r.subjectId,
      subjectName: subjectMap.get(r.subjectId)?.name ?? "Unknown",
      totalQ: r.totalQuestions,
      correct: r.correctAnswers,
      scorePercent: r.scorePercent,
      passed: r.passed,
      takenAt: r.takenAt,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Admin: Get a single mock exam with full questions ──────────────────────

  @Get("admin/:id")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({ summary: "Get a mock exam with full questions (Admin Only)" })
  async getMockExam(@Param("id") id: string): Promise<any> {
    const exam = await this.mockExamRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException("Mock exam not found");
    const duration = exam.durationMinutes ?? Math.ceil((exam.questionCount || 0) * 1.5);
    return {
      ...exam,
      durationMinutes: duration,
    };
  }

  // ── Admin: Update mock exam access type (Free or Paid) ───────────────────

  @Patch("admin/:id/access")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({ summary: "Update mock exam access type (Free or Paid) (Admin Only)" })
  async updateMockExamAccess(
    @Param("id") id: string,
    @Body() body: UpdateMockExamAccessDto,
  ): Promise<{ success: boolean; id: string; isFree: boolean; accessType: string }> {
    const exam = await this.mockExamRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException("Mock exam not found");

    const isFree = body.isFree ?? (body.accessType === "free");
    const accessType = body.accessType ?? (isFree ? "free" : "paid");

    await this.mockExamRepo.update(id, { isFree, accessType });
    return { success: true, id, isFree, accessType };
  }

  // ── Admin: Update mock exam (label, durationMinutes, isFree, accessType) ──

  @Patch("admin/:id")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({ summary: "Update mock exam details (label, durationMinutes, isFree, accessType) (Admin Only)" })
  async updateMockExam(
    @Param("id") id: string,
    @Body() body: UpdateMockExamDto,
  ): Promise<{ success: boolean; exam: any }> {
    const exam = await this.mockExamRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException("Mock exam not found");

    const updates: Partial<MockExamEntity> = {};

    if (body.label !== undefined) {
      if (!body.label.trim()) {
        throw new BadRequestException("Label cannot be empty.");
      }
      updates.label = body.label.trim();
    }

    const duration = body.durationMinutes ?? (body as any).duration_minutes;
    if (duration !== undefined) {
      updates.durationMinutes = duration;
    }

    if (body.isFree !== undefined || body.accessType !== undefined) {
      const isFree = body.isFree ?? (body.accessType === "free");
      const accessType = body.accessType ?? (isFree ? "free" : "paid");
      updates.isFree = isFree;
      updates.accessType = accessType;
    }

    if (Object.keys(updates).length > 0) {
      await this.mockExamRepo.update(id, updates);
    }

    const updated = await this.mockExamRepo.findOne({ where: { id } });
    const finalDuration = updated?.durationMinutes ?? Math.ceil(((updated?.questionCount || 0) * 1.5));

    return {
      success: true,
      exam: {
        ...updated!,
        durationMinutes: finalDuration,
      },
    };
  }

  @Delete("admin/:id")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({ summary: "Delete a mock exam (Admin Only)" })
  async deleteMockExam(@Param("id") id: string): Promise<{ success: boolean }> {
    const result = await this.mockExamRepo.delete(id);
    if (!result.affected) throw new NotFoundException("Mock exam not found");
    return { success: true };
  }

  // ── Student: My mock exam results & history ──────────────────────────────

  @Get("my-results")
  @SkipThrottle()
  @ApiOperation({
    summary: "Get past mock exam attempts and results for current student",
    description: "Returns results of completed mock exams taken by the authenticated student.",
  })
  async getMyMockResults(@CurrentUser() user: UserInfo) {
    const results = await this.resultRepo
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.exam", "exam")
      .leftJoinAndSelect("r.subject", "subject")
      .where("r.accountId = :userId", { userId: user.id })
      .orderBy("r.takenAt", "DESC")
      .getMany();

    return {
      data: results.map((r) => ({
        id: r.id,
        examId: r.examId,
        examTitle: r.exam?.label ?? "Mock Exam",
        subjectId: r.subjectId,
        subjectName: r.subject?.name ?? "",
        totalQuestions: r.totalQuestions,
        correctAnswers: r.correctAnswers,
        scorePercent: r.scorePercent,
        passed: r.passed,
        takenAt: r.takenAt,
      })),
    };
  }

  // ── Subjects list (student + admin) ───────────────────────────────────────

  @Get("subjects")
  @SkipThrottle()
  @ApiOperation({
    summary: "Get subjects available for mock exams",
    description:
      "Admin: all subjects. Students: filtered by their stream. Includes examCount per subject. Supports stream name filtering.",
  })
  @ApiQuery({
    name: "stream",
    required: false,
    description:
      "Filter by stream name or alias (e.g. Natural, Social, Natural Science, Social Science)",
  })
  async getMockSubjects(
    @CurrentUser() user: UserInfo,
    @Query("stream") stream?: string,
  ) {
    const account = await this.accountRepo.findOne({ where: { id: user.id } });
    const isAdmin = account?.type === "admin";

    // 1. Resolve stream: query param takes precedence, then user streamId, then user type
    let streamId: string | null = null;
    if (stream?.trim()) {
      streamId = await this.resolveStreamId(stream.trim());
    }
    if (!streamId && (account as any)?.streamId) {
      streamId = await this.resolveStreamId((account as any).streamId);
    }
    if (!streamId && (account?.type === "natural" || account?.type === "social")) {
      streamId = await this.resolveStreamId(account.type);
    }
    if (!streamId && (user?.type === "natural" || user?.type === "social")) {
      streamId = await this.resolveStreamId(user.type);
    }

    const qb = this.subjectRepo
      .createQueryBuilder("s")
      .select(["s.id", "s.name", "s.description", "s.streamId"])
      .orderBy("s.name", "ASC");

    if (!isAdmin) {
      if (streamId) {
        qb.where("s.streamId = :streamId OR s.streamId IS NULL", { streamId });
      } else {
        // Fallback safety: default to Natural Science instead of leaking all streams
        const defaultStream = await this.resolveStreamId("Natural Science");
        if (defaultStream) {
          qb.where("s.streamId = :streamId OR s.streamId IS NULL", { streamId: defaultStream });
        }
      }
    } else if (isAdmin && streamId) {
      // Even admins can filter by stream if query param is provided
      qb.where("s.streamId = :streamId OR s.streamId IS NULL", { streamId });
    }

    const subjects = await qb.getMany();

    if (subjects.length === 0) return [];

    // Count completed mock exams per subject in a single query
    const subjectIds = subjects.map((s) => s.id);
    const counts: { subjectId: string; count: string }[] =
      await this.mockExamRepo
        .createQueryBuilder("m")
        .select("m.subjectId", "subjectId")
        .addSelect("COUNT(m.id)", "count")
        .where("m.subjectId IN (:...ids)", { ids: subjectIds })
        .andWhere("m.status = 'completed'")
        .groupBy("m.subjectId")
        .getRawMany();

    const countMap = new Map(counts.map((c) => [c.subjectId, Number(c.count)]));

    return subjects.map((s) => ({
      ...s,
      examCount: countMap.get(s.id) ?? 0,
    }));
  }

  // ── Student: List available exams for a subject ────────────────────────────

  @Get("subject/:subjectId")
  @SkipThrottle()
  @ApiOperation({
    summary: "List available mock exams for a subject (Student)",
    description:
      "Returns exam metadata without questions — student picks one to start.",
  })
  async listExamsForSubject(
    @Param("subjectId") subjectId: string,
  ): Promise<any[]> {
    const exams = await this.mockExamRepo
      .createQueryBuilder("m")
      .select([
        "m.id",
        "m.subjectId",
        "m.label",
        "m.questionCount",
        "m.durationMinutes",
        "m.isFree",
        "m.accessType",
        "m.createdAt",
      ])
      .where("m.subjectId = :subjectId", { subjectId })
      .orderBy("m.createdAt", "ASC")
      .getMany();

    return exams.map((e) => {
      const duration = e.durationMinutes ?? Math.ceil((e.questionCount || 0) * 1.5);
      return {
        ...e,
        durationMinutes: duration,
      };
    });
  }

  // ── Student: Start a specific mock exam ───────────────────────────────────

  @Get(":examId/start")
  @SkipThrottle()
  @ApiOperation({
    summary: "Start a specific mock exam",
    description:
      "Free exam / free subject: all users get full access (all questions + sessionId). " +
      "Other subjects: premium users get full access; free users get first 3 questions " +
      "with isFreePreview=true and the rest locked (choices omitted, no sessionId).",
  })
  async startMockExam(
    @Param("examId") examId: string,
    @CurrentUser() user: UserInfo,
  ) {
    const exam = await this.mockExamRepo.findOne({ where: { id: examId } });
    if (!exam) throw new NotFoundException("Mock exam not found");

    const subject = await this.subjectRepo.findOne({
      where: { id: exam.subjectId },
    });

    const isFreeExam = exam.isFree === true || exam.accessType === "free";
    const freeSubjectId = await this._getFreeSubjectId();
    const isFreeSubject =
      (!!freeSubjectId && exam.subjectId === freeSubjectId) ||
      subject?.isFree === true ||
      isFreeExam;

    // Check live premium status from DB if not free subject
    let isPremiumActive = isFreeSubject;
    if (!isPremiumActive) {
      const account = await this.accountRepo.findOne({
        where: { id: user.id },
        select: ["id", "isPremium", "premiumEndDate"],
      });
      isPremiumActive =
        account?.isPremium === true &&
        (!account.premiumEndDate || account.premiumEndDate > new Date());
    }

    const FREE_PREVIEW_COUNT = 3;

    // Only create a session when user has full access
    let sessionId: string | null = null;
    if (isPremiumActive) {
      const session = await this.createSessionUsecase.run(user.id, {
        subjectId: exam.subjectId,
      });
      sessionId = session.sessionId;
    }

    const questions = exam.questions.map((q, i) => {
      const isFreePreview = isPremiumActive || i < FREE_PREVIEW_COUNT;
      return {
        index: i,
        question: q.question,
        choices: q.choices, // always include choices — mobile app handles blur
        explanation: q.explanation ?? "",
        isFreePreview,
      };
    });

    const duration = exam.durationMinutes ?? Math.ceil(questions.length * 1.5);

    return {
      sessionId,
      examId: exam.id,
      label: exam.label,
      subjectId: exam.subjectId,
      subjectName: subject?.name ?? "",
      isPremium: isPremiumActive,
      isFreeSubject,
      isFreeExam,
      questions,
      totalQuestions: questions.length,
      durationMinutes: duration,
    };
  }

  // ── Student: Submit answers ────────────────────────────────────────────────

  @Post(":sessionId/submit")
  @SkipThrottle()
  @ApiOperation({
    summary: "Submit mock exam answers",
    description:
      "Requires a sessionId obtained from GET /mocks/:examId/start. " +
      "Each answer uses questionIndex (0-based) and selectedAnswer (A/B/C/D).",
  })
  async submitMockExam(
    @Param("sessionId") sessionId: string,
    @Body() dto: SubmitMockExamDto,
    @CurrentUser() user: UserInfo,
  ) {
    if (!dto.answers?.length) {
      throw new BadRequestException("No answers provided.");
    }

    const examId = dto.examId;

    // Fetch exam first — needed for the free subject/exam check below
    const exam = await this.mockExamRepo.findOne({ where: { id: examId } });
    if (!exam) throw new NotFoundException("Mock exam not found.");

    const isFreeExam = exam.isFree === true || exam.accessType === "free";
    const freeSubjectId = await this._getFreeSubjectId();
    const isFreeSubject =
      (!!freeSubjectId && exam.subjectId === freeSubjectId) || isFreeExam;

    if (!isFreeSubject) {
      // Live DB premium check for non-free subjects
      const account = await this.accountRepo.findOne({
        where: { id: user.id },
        select: ["id", "isPremium", "premiumEndDate"],
      });
      const isPremiumActive =
        account?.isPremium === true &&
        (!account.premiumEndDate || account.premiumEndDate > new Date());

      if (!isPremiumActive) {
        throw new BadRequestException(
          "Premium subscription required to submit mock exam answers.",
        );
      }
    }

    // Score the answers
    let correct = 0;
    const breakdown = dto.answers
      .map((a) => {
        const q = exam.questions[a.questionIndex];
        if (!q) return null;
        const isCorrect =
          a.selectedAnswer.trim().toUpperCase().charAt(0) === q.answer;
        if (isCorrect) correct++;
        return {
          questionIndex: a.questionIndex,
          question: q.question,
          selectedAnswer: a.selectedAnswer,
          correctAnswer: q.answer,
          isCorrect,
          explanation: q.explanation,
          timeSpentMs: a.timeSpentMs,
        };
      })
      .filter(Boolean);

    const total = dto.answers.length;
    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Persist result for admin reporting
    await this.resultRepo.save(
      this.resultRepo.create({
        examId: exam.id,
        accountId: user.id,
        subjectId: exam.subjectId,
        sessionId,
        totalQuestions: total,
        correctAnswers: correct,
        scorePercent,
        passed: scorePercent >= 50,
      }),
    );

    return {
      success: true,
      sessionId,
      examId: exam.id,
      label: exam.label,
      score: {
        correct,
        total,
        scorePercent,
        passed: scorePercent >= 50,
      },
      breakdown,
    };
  }

  // ── Explanation: get cached ────────────────────────────────────────────────

  @Get(":examId/questions/:questionIndex/explanation")
  @SkipThrottle()
  @ApiOperation({
    summary: "Get explanation for a mock exam question (auto-generates if not cached)",
    description: "Returns cached explanation if available, otherwise automatically generates and caches it.",
  })
  async getMockExplanation(
    @Param("examId") examId: string,
    @Param("questionIndex") questionIndex: string,
  ): Promise<MockExplanationEntity> {
    return this.mockExplanationService.getOrGenerate(examId, parseInt(questionIndex, 10));
  }

  // ── Explanation: generate (or return cached) ───────────────────────────────

  @Post(":examId/questions/:questionIndex/explanation/generate")
  @SkipThrottle()
  @ApiOperation({
    summary: "Generate (or return cached) explanation for a mock exam question",
    description:
      "If the mock exam question already has an embedded explanation from AI generation, " +
      "it is saved and returned immediately without an extra AI call. " +
      "On subsequent calls the cached explanation is returned and usageCount is incremented.",
  })
  async generateMockExplanation(
    @Param("examId") examId: string,
    @Param("questionIndex") questionIndex: string,
  ): Promise<MockExplanationEntity> {
    return this.mockExplanationService.getOrGenerate(examId, parseInt(questionIndex, 10));
  }
}
