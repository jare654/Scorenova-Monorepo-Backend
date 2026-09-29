import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { AnalyticsQueries } from "../usecases/analytics.queries";

@ApiTags("analytics")
@ApiBearerAuth("Bearer")
@Controller("analytics")
@UseGuards(RolesGuard("admin"))
export class AnalyticsController {
  constructor(private readonly analyticsQueries: AnalyticsQueries) {}

  @Get("overview")
  @ApiOperation({ summary: "System overview — users, content, performance (Admin Only)" })
  getOverview() {
    return this.analyticsQueries.getOverview();
  }

  @Get("daily-active-users")
  @ApiOperation({ summary: "Daily active users - last 24h (Admin Only)" })
  getDailyActiveUsers() {
    return this.analyticsQueries.getDailyActiveUsers();
  }

  @Get("monthly-active-users")
  @ApiOperation({ summary: "Monthly active users - last 30 days (Admin Only)" })
  getMonthlyActiveUsers() {
    return this.analyticsQueries.getMonthlyActiveUsers();
  }

  @Get("peak-hours")
  @ApiOperation({ summary: "Attempt counts by hour of day (Admin Only)" })
  getPeakHours() {
    return this.analyticsQueries.getPeakHours();
  }

  @Get("registration-trend")
  @ApiOperation({ summary: "Daily new user registrations (Admin Only)" })
  getRegistrationTrend() {
    return this.analyticsQueries.getRegistrationTrend();
  }

  @Get("users-by-package")
  @ApiOperation({ summary: "User counts by subscription package (Admin Only)" })
  getUsersByPackage() {
    return this.analyticsQueries.getUsersByPackage();
  }

  @Get("average-study-time")
  @ApiOperation({ summary: "Average study time per user (Admin Only)" })
  getAverageStudyTime() {
    return this.analyticsQueries.getAverageStudyTime();
  }

  @Get("pass-fail-ratio")
  @ApiOperation({ summary: "Pass/fail ratio across all mock exam sessions (Admin Only)" })
  getPassFailRatio() {
    return this.analyticsQueries.getPassFailRatio();
  }

  @Get("drop-off-points")
  @ApiOperation({ summary: "Subjects where users stop engaging - drop-off (Admin Only)" })
  getDropOffPoints() {
    return this.analyticsQueries.getDropOffPoints();
  }

  @Get("content-coverage")
  @ApiOperation({ summary: "% of subjects attempted per stream (Admin Only)" })
  getContentCoverage() {
    return this.analyticsQueries.getContentCoverage();
  }

  @Get("question-difficulty-stats")
  @ApiOperation({ summary: "Attempt accuracy broken down by question difficulty (Admin Only)" })
  getQuestionDifficultyStats() {
    return this.analyticsQueries.getQuestionDifficultyStats();
  }
}
