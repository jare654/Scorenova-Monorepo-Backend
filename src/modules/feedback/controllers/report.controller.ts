import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
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
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { AccountEntity } from "@account/models/accounts/account.entity";

import {
  UserReportEntity,
  ReportType,
  ReportStatus,
} from "../models/user-report.entity";
import { NotificationService } from "../../notification/notification.service";

// ─── Valid types matching the mobile app screen ───────────────────────────────

const VALID_TYPES: ReportType[] = [
  "sign_up_problems",
  "upload_scan_failed",
  "app_crashes",
  "wrong_answer",
  "subscription_issue",
  "other",
  "bug",
  "question_issue",
  "content",
];

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateReportDto {
  @ApiProperty({
    enum: VALID_TYPES,
    default: "other",
    example: "app_crashes",
    description:
      "Issue category: sign_up_problems | upload_scan_failed | app_crashes | " +
      "wrong_answer | subscription_issue | other",
  })
  @IsEnum(VALID_TYPES)
  @IsOptional()
  type?: ReportType;

  @ApiProperty({ example: "The app crashes when I tap submit in mock exam mode." })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ required: false, description: "Related question ID if issue is about a specific question", example: "f47ac10b-58cc-4372-a567-0e02b2c3d479" })
  @IsUUID()
  @IsOptional()
  questionId?: string;

  @ApiProperty({ required: false, description: "URL of uploaded screenshot (optional)", example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." })
  @IsString()
  @IsOptional()
  screenshotUrl?: string;
}

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ["open", "in_progress", "resolved", "closed"], example: "resolved" })
  @IsEnum(["open", "in_progress", "resolved", "closed"])
  status: ReportStatus;

  @ApiProperty({ required: false, description: "Optional admin note", example: "Issue investigated and fixed in backend v1.2.0 release." })
  @IsString()
  @IsOptional()
  adminNote?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags("reports")
@Controller("reports")
@ApiBearerAuth("Bearer")
export class ReportController {
  constructor(
    @InjectRepository(UserReportEntity)
    private readonly reportRepo: Repository<UserReportEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Upload screenshot — declared BEFORE /:id routes ───────────────────────

  @Post("upload-screenshot")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new Error("Only image files are allowed"), false);
        }
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({
    summary: "Upload a screenshot for an issue report",
    description:
      "Accepts an image file (max 5 MB). Returns a base64 data URL. " +
      "Pass the returned screenshotUrl when submitting a report.",
  })
  async uploadScreenshot(@UploadedFile() file: any) {
    if (!file?.buffer) {
      return { success: false, message: "No file uploaded" };
    }
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    return { success: true, screenshotUrl: dataUrl };
  }

  // ── Student: submit a report ───────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: "Submit an issue report (mobile app)" })
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: UserInfo,
  ) {
    const report = await this.reportRepo.save(
      this.reportRepo.create({
        accountId:     user.id,
        type:          dto.type ?? "other",
        description:   dto.description,
        questionId:    dto.questionId ?? null,
        screenshotUrl: dto.screenshotUrl ?? null,
        status:        "open",
      }),
    );
    return { success: true, reportId: report.id };
  }

  // ── Student: get my reports ────────────────────────────────────────────────

  @Get("my")
  @ApiOperation({ summary: "Get my submitted reports" })
  async getMyReports(@CurrentUser() user: UserInfo) {
    const reports = await this.reportRepo.find({
      where: { accountId: user.id },
      order: { createdAt: "DESC" },
    });
    return { data: reports };
  }

  // ── Admin: list all reports with student info ──────────────────────────────

  @Get()
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "List all user reports with student info (Admin Only)" })
  async getAllReports(
    @Query("status") status?: ReportStatus,
    @Query("type")   type?: ReportType,
    @Query("search") search?: string,
    @Query("page")   pageStr = "1",
    @Query("limit")  limitStr = "20",
  ) {
    const page  = Math.max(1, Number(pageStr)  || 1);
    const limit = Math.min(100, Math.max(1, Number(limitStr) || 20));

    const qb = this.reportRepo
      .createQueryBuilder("r")
      .orderBy("r.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere("r.status = :status", { status });
    if (type)   qb.andWhere("r.type = :type", { type });
    if (search?.trim()) {
      qb.andWhere("r.description ILIKE :search", { search: `%${search.trim()}%` });
    }

    const [reports, total] = await qb.getManyAndCount();

    if (reports.length === 0) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const accountIds = [...new Set(reports.map((r) => r.accountId))];
    const accounts = await this.accountRepo
      .createQueryBuilder("a")
      .select(["a.id", "a.name", "a.phoneNumber"])
      .where("a.id IN (:...ids)", { ids: accountIds })
      .getMany();

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const data = reports.map((r) => ({
      id:            r.id,
      type:          r.type,
      description:   r.description,
      screenshotUrl: r.screenshotUrl,
      questionId:    r.questionId,
      status:        r.status,
      createdAt:     r.createdAt,
      updatedAt:     r.updatedAt,
      studentName:   accountMap.get(r.accountId)?.name        ?? "Unknown",
      studentPhone:  accountMap.get(r.accountId)?.phoneNumber ?? "—",
      accountId:     r.accountId,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Admin: get single report ───────────────────────────────────────────────

  @Get(":id")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Get a single report (Admin Only)" })
  async getReport(@Param("id") id: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException("Report not found");

    const account = await this.accountRepo.findOne({
      where: { id: report.accountId },
      select: ["id", "name", "phoneNumber", "email"],
    });

    return {
      ...report,
      studentName:  account?.name        ?? "Unknown",
      studentPhone: account?.phoneNumber ?? "—",
      studentEmail: account?.email       ?? "—",
    };
  }

  // ── Admin: update report status ────────────────────────────────────────────

  @Patch(":id/status")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Update report status (Admin Only)" })
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException("Report not found");
    report.status = dto.status;
    await this.reportRepo.save(report);

    if (dto.status === "resolved" && report.accountId) {
      try {
        const account = await this.accountRepo.findOne({
          where: { id: report.accountId },
          select: ["id", "fcmId"],
        });
        if (account) {
          const isPayment = (report.type as string) === "subscription_issue";
          const title = isPayment ? "Payment Verified & Approved 🎉" : "Issue Report Resolved ✅";
          const body = isPayment
            ? "Your payment receipt has been reviewed and approved! Your Premium subscription is now active. Enjoy full access!"
            : `Your report regarding "${report.type.replace(/_/g, " ")}" has been reviewed and resolved by our team.`;
          await this.notificationService.sendToUser(account.id, title, body, account.fcmId);
        }
      } catch (err) {
        console.error("Failed to send notification on report status update:", err);
      }
    }

    return { success: true, report };
  }
}
