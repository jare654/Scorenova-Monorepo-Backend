import {
  Body,
  ConflictException,
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
  ApiTags,
} from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RolesGuard } from "@account/auth/guards/role.quards";

import { SavedQuestionEntity } from "../models/saved-question.entity";
import { QuestionFlagEntity, FlagStatus } from "../models/question-flag.entity";
import { QuestionEntity } from "../models/questions/question.entity";
import { QuestionExplanationEntity } from "../models/question-explanation.entity";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export class FlagQuestionDto {
  @ApiProperty({ example: "The correct answer seems wrong" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class UpdateFlagStatusDto {
  @ApiProperty({ enum: ["pending", "reviewed", "resolved", "dismissed"], example: "resolved" })
  @IsEnum(["pending", "reviewed", "resolved", "dismissed"])
  status: FlagStatus;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags("questions")
@Controller("questions")
@ApiBearerAuth("Bearer")
export class SavedFlagController {
  constructor(
    @InjectRepository(SavedQuestionEntity)
    private readonly savedRepo: Repository<SavedQuestionEntity>,
    @InjectRepository(QuestionFlagEntity)
    private readonly flagRepo: Repository<QuestionFlagEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(QuestionExplanationEntity)
    private readonly explanationRepo: Repository<QuestionExplanationEntity>,
  ) {}

  // ── Saved questions ────────────────────────────────────────────────────────

  @Get("saved")
  @ApiOperation({
    summary: "Get my saved questions",
    description: "Returns bookmarked questions with their AI explanations (if generated).",
  })
  async getMySaved(@CurrentUser() user: UserInfo) {
    const saved = await this.savedRepo.find({
      where: { accountId: user.id },
      order: { createdAt: "DESC" },
    });

    if (saved.length === 0) return { data: [] };

    const questionIds = saved.map((s) => s.questionId);

    // Load questions and their explanations in parallel
    const [questions, explanations] = await Promise.all([
      this.questionRepo
        .createQueryBuilder("q")
        .where("q.id IN (:...ids)", { ids: questionIds })
        .getMany(),
      this.explanationRepo
        .createQueryBuilder("e")
        .where("e.questionId IN (:...ids)", { ids: questionIds })
        .getMany(),
    ]);

    const qMap = new Map(questions.map((q) => [q.id, q]));
    const expMap = new Map(explanations.map((e) => [e.questionId, e]));

    return {
      data: saved.map((s) => {
        const q = qMap.get(s.questionId) ?? null;
        const exp = expMap.get(s.questionId) ?? null;
        return {
          savedId: s.id,
          savedAt: s.createdAt,
          question: q,
          explanation: exp
            ? {
                stepByStep: exp.stepByStep,
                clear:      exp.clear,
                simplified: exp.simplified,
              }
            : null,
        };
      }),
    };
  }

  @Post(":id/save")
  @ApiOperation({ summary: "Save a question to favourites" })
  async saveQuestion(
    @Param("id") questionId: string,
    @CurrentUser() user: UserInfo,
  ) {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException("Question not found");

    const existing = await this.savedRepo.findOne({
      where: { accountId: user.id, questionId },
    });
    if (existing) throw new ConflictException("Question already saved");

    const saved = await this.savedRepo.save(
      this.savedRepo.create({ accountId: user.id, questionId }),
    );
    return { success: true, savedId: saved.id };
  }

  @Delete(":id/save")
  @ApiOperation({ summary: "Remove a question from favourites" })
  async unsaveQuestion(
    @Param("id") questionId: string,
    @CurrentUser() user: UserInfo,
  ) {
    const existing = await this.savedRepo.findOne({
      where: { accountId: user.id, questionId },
    });
    if (!existing) throw new NotFoundException("Saved question not found");
    await this.savedRepo.delete(existing.id);
    return { success: true };
  }

  // ── Question flags ─────────────────────────────────────────────────────────

  @Post(":id/flag")
  @ApiOperation({ summary: "Flag a question as having an issue" })
  async flagQuestion(
    @Param("id") questionId: string,
    @Body() dto: FlagQuestionDto,
    @CurrentUser() user: UserInfo,
  ) {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException("Question not found");

    const existing = await this.flagRepo.findOne({
      where: { accountId: user.id, questionId },
    });
    if (existing) {
      // Update reason if already flagged
      existing.reason = dto.reason;
      existing.status = "pending";
      await this.flagRepo.save(existing);
      return { success: true, flagId: existing.id, updated: true };
    }

    const flag = await this.flagRepo.save(
      this.flagRepo.create({
        accountId: user.id,
        questionId,
        reason: dto.reason,
        status: "pending",
      }),
    );
    return { success: true, flagId: flag.id, updated: false };
  }

  @Delete(":id/flag")
  @ApiOperation({ summary: "Remove your flag from a question" })
  async unflagQuestion(
    @Param("id") questionId: string,
    @CurrentUser() user: UserInfo,
  ) {
    const existing = await this.flagRepo.findOne({
      where: { accountId: user.id, questionId },
    });
    if (!existing) throw new NotFoundException("Flag not found");
    await this.flagRepo.delete(existing.id);
    return { success: true };
  }

  // ── Admin: view + manage flags ─────────────────────────────────────────────

  @Get("flags")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "List all flagged questions (Admin Only)" })
  async getAllFlags(
    @Query("status") status?: FlagStatus,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    const qb = this.flagRepo
      .createQueryBuilder("f")
      .orderBy("f.createdAt", "DESC")
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit));

    if (status) qb.where("f.status = :status", { status });

    const [data, total] = await qb.getManyAndCount();

    // Enrich with question text
    const questionIds = [...new Set(data.map((f) => f.questionId))];
    const questions =
      questionIds.length > 0
        ? await this.questionRepo
            .createQueryBuilder("q")
            .select(["q.id", "q.text"])
            .where("q.id IN (:...ids)", { ids: questionIds })
            .getMany()
        : [];
    const qMap = new Map(questions.map((q) => [q.id, q.text]));

    return {
      data: data.map((f) => ({
        ...f,
        questionText: qMap.get(f.questionId) ?? "—",
      })),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  @Patch("flags/:flagId/status")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Update flag status (Admin Only)" })
  async updateFlagStatus(
    @Param("flagId") flagId: string,
    @Body() dto: UpdateFlagStatusDto,
  ) {
    const flag = await this.flagRepo.findOne({ where: { id: flagId } });
    if (!flag) throw new NotFoundException("Flag not found");
    flag.status = dto.status;
    await this.flagRepo.save(flag);
    return { success: true, flag };
  }
}
