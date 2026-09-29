import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags, ApiProperty, ApiQuery } from "@nestjs/swagger";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { FeedbackEntity } from "../models/feedback.entity";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { Repository } from "typeorm";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "@account/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@account/auth/guards/role.quards";

export class CreateFeedbackDto {
  @ApiProperty({ example: "Great platform! The explanation for physics question 12 was very helpful." })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ required: false, example: "Practice Mode / Grade 12 Physics" })
  @IsString()
  @IsOptional()
  context?: string;
}

@ApiTags("feedbacks")
@Controller("feedbacks")
@ApiBearerAuth("Bearer")
export class FeedbackController {
  constructor(
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepo: Repository<FeedbackEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
  ) { }

  @Post("create-feedback")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create user feedback" })
  async createFeedback(
    @CurrentUser() user: UserInfo,
    @Body() body: CreateFeedbackDto,
  ) {
    const feedback = this.feedbackRepo.create({
      accountId: user.id,
      message: body.message,
      context: body.context,
    });
    await this.feedbackRepo.save(feedback);
    return { success: true, id: feedback.id };
  }

  @Get()
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "List all feedbacks (Admin Only)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  async getAllFeedbacks(
    @Query("page") pageStr = "1",
    @Query("limit") limitStr = "20",
    @Query("search") search?: string,
  ) {
    const page = Math.max(1, Number(pageStr) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitStr) || 20));

    const qb = this.feedbackRepo
      .createQueryBuilder("f")
      .orderBy("f.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (search?.trim()) {
      qb.andWhere("(f.message ILIKE :search OR f.context ILIKE :search)", {
        search: `%${search.trim()}%`,
      });
    }

    const [feedbacks, total] = await qb.getManyAndCount();

    if (feedbacks.length === 0) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const accountIds = [...new Set(feedbacks.map((f) => f.accountId))];
    const accounts = await this.accountRepo
      .createQueryBuilder("a")
      .select(["a.id", "a.name", "a.phoneNumber", "a.email"])
      .where("a.id IN (:...ids)", { ids: accountIds })
      .getMany();

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const data = feedbacks.map((f) => ({
      id: f.id,
      accountId: f.accountId,
      message: f.message,
      context: f.context,
      createdAt: f.createdAt,
      studentName: accountMap.get(f.accountId)?.name ?? "Unknown",
      studentPhone: accountMap.get(f.accountId)?.phoneNumber ?? "—",
      studentEmail: accountMap.get(f.accountId)?.email ?? "—",
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

