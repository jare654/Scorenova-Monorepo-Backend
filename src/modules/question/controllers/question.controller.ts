import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as jwt from "jsonwebtoken";

import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { SettingsService } from "../../settings/settings.service";

import { QuestionEntity } from "../models/questions/question.entity";
import { QuestionQueries } from "../usecases/questions/question.usecase.queries";
import { QuestionCommands } from "../usecases/questions/question.usecase.commands";
import {
  BulkDeleteQuestionsDto,
  CreateQuestionDto,
  UpdateQuestionDto,
} from "../usecases/questions/question.commands";
import { QuestionQueryDto } from "../usecases/questions/question-query.dto";
import { QuestionListResponseDto } from "../usecases/questions/question.response";
import { ExplanationService } from "../services/explanation.service";
import { BulkUploadService } from "../services/bulk-upload.service";
import { CreateExamSessionUsecase } from "../../attempt/usecases/attempts/create-exam-session.usecase";
import { RecordAttemptsBatchUsecase } from "../../attempt/usecases/attempts/record-attempts-batch.usecase";

export class SubmitAnswerDto {
  @ApiProperty({ example: "0" })
  @IsString()
  @IsNotEmpty()
  selectedAnswer: string;

  @ApiProperty({ example: 45 })
  @IsNumber()
  timeSpentSeconds: number;
}

@ApiTags("questions")
@Controller("questions")
export class QuestionController {
  constructor(
    private readonly questionQueries: QuestionQueries,
    private readonly questionCommands: QuestionCommands,
    private readonly explanationService: ExplanationService,
    private readonly bulkUploadService: BulkUploadService,
    private readonly createSessionUsecase: CreateExamSessionUsecase,
    private readonly recordBatchUsecase: RecordAttemptsBatchUsecase,
    private readonly settingsService: SettingsService,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
  ) {}

  /** Read freeSubjectId from settings once per call — fast JSONB lookup. */
  private async _getFreeSubjectId(): Promise<string | null> {
    try {
      const s = await this.settingsService.getSection("premium");
      return (s?.data?.freeSubjectId as string) ?? null;
    } catch {
      return null;
    }
  }

  // ─── Public read ──────────────────────────────────────────────────────────

  @Get()
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "Fetch questions",
    description:
      "Paginated question list. " +
      "One subject is designated as the free subject (set via Settings → freeSubjectId). " +
      "For free/unauthenticated users: questions from the free subject are fully unlocked; " +
      "all other subjects return isFreePreview=false with no answer data. " +
      "Premium users receive all questions unlocked.",
  })
  async getQuestions(
    @Query() query: QuestionQueryDto,
    @Headers("authorization") authHeader?: string,
  ): Promise<QuestionListResponseDto> {
    const isPremium     = this._extractIsPremium(authHeader);
    const freeSubjectId = await this._getFreeSubjectId();
    return this.questionQueries.findQuestions(query, isPremium, freeSubjectId);
  }

  /** Safely decode the Bearer JWT without throwing — used for optional auth. */
  private _extractIsPremium(authHeader?: string): boolean {
    if (!authHeader?.startsWith("Bearer ")) return false;
    try {
      const token = authHeader.slice(7);
      const secret =
        process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production-min-32-chars";
      const payload = jwt.verify(token, secret) as Record<string, unknown>;
      return (
        payload.isPremium === true ||
        payload.type === "admin" ||
        (payload.role as any)?.key === "admin"
      );
    } catch {
      return false;
    }
  }

  // ─── Admin stats ──────────────────────────────────────────────────────────

  @Get("statistics")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Get aggregate question statistics (Admin Only)" })
  getStatistics() {
    return this.questionQueries.getStatistics();
  }

  // ─── Bulk operations ──────────────────────────────────────────────────────

  @Post("bulk-upload")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiOperation({
    summary: "Bulk upload questions from CSV or Excel (Admin Only)",
    description:
      "Upload a .csv or .xlsx file. Required columns: text, correctAnswer, subjectName. " +
      "Optional: options (pipe-separated), difficulty, topicName, explanation.",
  })
  async bulkUpload(@UploadedFile() file: any) {
    if (!file?.buffer) {
      return { success: false, message: "No file uploaded" };
    }
    try {
      const result = await this.bulkUploadService.processFile(file);
      return { success: true, ...result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : "";
      console.error("[BulkUpload] ERROR:", msg, stack);
      throw err;
    }
  }

  @Post("bulk-delete")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Bulk delete questions by IDs (Admin Only)" })
  bulkDeleteQuestions(@Body() dto: BulkDeleteQuestionsDto) {
    return this.questionCommands.bulkDeleteQuestions(dto.ids);
  }

  // ─── Single question CRUD ─────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Create a question (Admin Only)" })
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.questionCommands.createQuestion(dto);
  }

  @Put(":id")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Full update a question (Admin Only)" })
  updateQuestionPut(@Param("id") id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionCommands.updateQuestion(id, dto);
  }

  @Patch(":id")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Partial update a question (Admin Only)" })
  updateQuestion(@Param("id") id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionCommands.updateQuestion(id, dto);
  }

  @Delete(":id")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Delete a question (Admin Only)" })
  deleteQuestion(@Param("id") id: string) {
    return this.questionCommands.deleteQuestion(id);
  }

  @Get(":id/edit")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Get question for editing (Admin Only)" })
  async getQuestionForEdit(@Param("id") id: string) {
    const question = await this.questionRepo.findOne({ where: { id } });
    if (!question) throw new NotFoundException("Question not found");
    return { success: true, data: question };
  }

  @Get(":id/statistics")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Get per-question attempt statistics (Admin Only)" })
  async getSingleQuestionStatistics(@Param("id") id: string) {
    const stats = await this.questionQueries.getSingleQuestionStatistics(id);
    return { success: true, data: stats };
  }

  // ─── Explanation endpoints ────────────────────────────────────────────────

  @Get(":id/explanations")
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "Get cached explanation for a question",
    description:
      "Returns the cached AI explanation. Returns 404 if none has been generated yet.",
  })
  async getExplanation(@Param("id") id: string) {
    const explanation = await this.explanationService.getExplanation(id);
    return {
      success: true,
      data: {
        questionId: explanation.questionId,
        stepByStep: explanation.stepByStep,
        clear: explanation.clear,
        simplified: explanation.simplified,
        usageCount: explanation.usageCount,
        createdAt: explanation.createdAt,
      },
    };
  }

  @Post(":id/explanations/generate")
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "Get or generate AI explanation for a question",
    description:
      "Returns cached explanation if available. Otherwise calls AI, caches the result, and returns it.",
  })
  async generateExplanation(@Param("id") id: string) {
    const explanation = await this.explanationService.getOrGenerate(id);
    return {
      success: true,
      data: {
        questionId: explanation.questionId,
        stepByStep: explanation.stepByStep,
        clear: explanation.clear,
        simplified: explanation.simplified,
        usageCount: explanation.usageCount,
        createdAt: explanation.createdAt,
      },
    };
  }

  // ─── Student answer submission ────────────────────────────────────────────

  @Post(":id/submit")
  @ApiBearerAuth("Bearer")
  @SkipThrottle()
  @ApiOperation({
    summary: "Submit an answer for a question",
    description:
      "Any authenticated user can submit. Answer and attempt are recorded for progress tracking. " +
      "Free users can submit on the free-preview questions; premium users can submit all.",
  })
  async submitAnswer(
    @Param("id") questionId: string,
    @Body() body: SubmitAnswerDto,
    @CurrentUser() user: UserInfo,
  ) {
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException("Question not found");

    const sessionResponse = await this.createSessionUsecase.run(user.id, {
      subjectId: question.subjectId,
    });

    const recordResponse = await this.recordBatchUsecase.run(user.id, {
      sessionId: sessionResponse.sessionId,
      attempts: [
        {
          questionId: question.id,
          topicId: question.topicId,
          selectedAnswer: body.selectedAnswer,
          timeSpentMs: body.timeSpentSeconds * 1000,
        },
      ],
    });

    const isCorrect =
      String(question.correctAnswer).trim() ===
      String(body.selectedAnswer).trim();

    // Fire-and-forget: pre-cache the explanation so it's ready instantly
    // when the student taps "See Explanation" — doesn't block the response
    this.explanationService.getOrGenerate(questionId).catch(() => {/* non-critical */});

    return {
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      selectedAnswer: body.selectedAnswer,
      explanation: question.explanation,
      attemptId: recordResponse.attemptIds?.[0] ?? null,
    };
  }

  @Post("fix-orphaned-topics")
  @ApiBearerAuth("Bearer")
  @UseGuards(RolesGuard("admin"))
  @SkipThrottle()
  @ApiOperation({
    summary: "Assign questions with NULL or invalid topic_id to curriculum topics (Admin Only)",
    description:
      "Finds questions where topic_id IS NULL or referenced topic does not exist, " +
      "and reassigns them to valid predefined curriculum topics under their subject.",
  })
  async fixOrphanedTopics() {
    const mgr = this.questionRepo.manager;
    const orphaned: Array<{ id: string; subject_id: string }> = await mgr.query(`
      SELECT q.id, q.subject_id
      FROM questions q
      WHERE q.topic_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM topics t WHERE t.id = q.topic_id)
    `);

    if (orphaned.length === 0) {
      return { success: true, fixedCount: 0, message: "All questions have valid curriculum topics." };
    }

    let fixedCount = 0;
    for (const q of orphaned) {
      if (!q.subject_id) continue;
      const topics: Array<{ id: string }> = await mgr.query(
        `SELECT id FROM topics WHERE subject_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [q.subject_id],
      );

      if (topics.length > 0) {
        await mgr.query(`UPDATE questions SET topic_id = $1 WHERE id = $2`, [topics[0].id, q.id]);
        fixedCount += 1;
      }
    }

    return {
      success: true,
      fixedCount,
      message: `Successfully assigned ${fixedCount} orphaned questions to curriculum topics.`,
    };
  }
}
