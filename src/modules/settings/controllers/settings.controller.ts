import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { SettingsService } from "../settings.service";
import { UpdateSettingsDto } from "../dtos/update-settings.dto";

export class UpdatePlansDto {
  @ApiPropertyOptional({ example: 350 })
  @IsNumber()
  @IsOptional()
  monthlyPrice?: number;

  @ApiPropertyOptional({ example: 900 })
  @IsNumber()
  @IsOptional()
  quarterlyPrice?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsNumber()
  @IsOptional()
  annualPrice?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsNumber()
  @IsOptional()
  monthlyDurationDays?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsNumber()
  @IsOptional()
  quarterlyDurationDays?: number;

  @ApiPropertyOptional({ example: 365 })
  @IsNumber()
  @IsOptional()
  annualDurationDays?: number;

  @ApiPropertyOptional({ example: "ETB" })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: "@scorenovasupport" })
  @IsString()
  @IsOptional()
  telegramSupport?: string;

  @ApiPropertyOptional({ example: "Full access to all subjects, questions, and mock exams" })
  @IsString()
  @IsOptional()
  benefitsDescription?: string;

  @ApiPropertyOptional({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsString()
  @IsOptional()
  freeSubjectId?: string | null;
}

@ApiTags("settings")
@ApiBearerAuth("Bearer")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Public: get subscription plans (used by mobile app + admin dashboard) ──

  @Get("plans")
  @AllowAnonymous()
  @ApiOperation({
    summary: "Get subscription plans",
    description:
      "Returns all three subscription plans (Monthly, Quarterly, Annual) with " +
      "prices, durations and currency. Used by mobile app to show pricing screen.",
  })
  async getPlans() {
    const s = await this.settingsService.getSection("premium");
    const d = s?.data ?? {};
    const currency = (d.currency as string) ?? "ETB";
    const freeSubjectId = (d.freeSubjectId as string | null) ?? null;

    return {
      currency,
      freeSubjectId,
      plans: [
        {
          id:           "monthly",
          label:        "Monthly",
          durationDays: (d.monthlyDurationDays as number) ?? 30,
          price:        (d.monthlyPrice as number) ?? 0,
          currency,
        },
        {
          id:           "quarterly",
          label:        "Quarterly",
          durationDays: (d.quarterlyDurationDays as number) ?? 90,
          price:        (d.quarterlyPrice as number) ?? 0,
          currency,
          savings:      d.monthlyPrice
            ? Math.round(100 - (((d.quarterlyPrice as number) ?? 0) / ((d.monthlyPrice as number) * 3)) * 100)
            : 0,
        },
        {
          id:           "annual",
          label:        "Annual",
          durationDays: (d.annualDurationDays as number) ?? 365,
          price:        (d.annualPrice as number) ?? 0,
          currency,
          savings:      d.monthlyPrice
            ? Math.round(100 - (((d.annualPrice as number) ?? 0) / ((d.monthlyPrice as number) * 12)) * 100)
            : 0,
          badge:        "Best value",
        },
      ],
      telegramSupport:     (d.telegramSupport as string)     ?? "",
      benefitsDescription: (d.benefitsDescription as string) ?? "",
    };
  }

  // ── Admin: update subscription plans pricing directly ──────────────────────

  @Put("plans")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Update subscription plans pricing and configuration (Admin Only)",
    description: "Updates monthly, quarterly, annual prices, duration days, currency, and support info.",
  })
  async updatePlans(@Body() body: UpdatePlansDto) {
    const existing = await this.settingsService.getSection("premium");
    const currentData = existing?.data ?? {};
    const updatedData = {
      ...currentData,
      ...body,
    };
    await this.settingsService.updateSection("premium", updatedData);
    return this.getPlans();
  }

  // ── Get any settings section ───────────────────────────────────────────────

  @Get(":section")
  @AllowAnonymous()
  @ApiOperation({ summary: "Get settings section" })
  async getSection(@Param("section") section: string) {
    return this.settingsService.getSection(section);
  }

  @Put(":section")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Update settings section (Admin Only)" })
  async updateSection(
    @Param("section") section: string,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSection(section, body.data);
  }
}
