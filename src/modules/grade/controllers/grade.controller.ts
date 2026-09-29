import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GradeQueries } from "../usecases/grades/grade.usecase.queries";
import { GradeCommands } from "../usecases/grades/grade.usecase.commands";
import { CreateGradeDto, UpdateGradeDto } from "../usecases/grades/grade.commands";
import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("grades")
@ApiBearerAuth("Bearer")
@Controller("grades")
export class GradeController {
  constructor(
    private readonly gradeQueries: GradeQueries,
    private readonly gradeCommands: GradeCommands,
  ) {}

  @Get()
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({
    summary: "List all grades",
    description: "Retrieves all academic grades registered in the system.",
  })
  getGrades() {
    return this.gradeQueries.getGrades();
  }

  @Post()
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Create a new grade (Admin Only)",
    description: "Creates a new grade level.",
  })
  createGrade(@Body() dto: CreateGradeDto) {
    return this.gradeCommands.createGrade(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Update a grade (Admin Only)",
    description: "Updates grade name or details for specified grade ID.",
  })
  updateGrade(@Param("id") id: string, @Body() dto: UpdateGradeDto) {
    return this.gradeCommands.updateGrade(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Delete a grade (Admin Only)",
    description: "Deletes specified grade level.",
  })
  deleteGrade(@Param("id") id: string) {
    return this.gradeCommands.deleteGrade(id);
  }

  @Get("all/statistics")
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({ summary: "Get statistics for all grades" })
  getAllGradesStatistics() {
    return this.gradeQueries.getAllGradesStatistics();
  }

  @Get(":id/statistics")
  @AllowAnonymous()
  @SkipThrottle()
  @ApiOperation({ summary: "Get grade statistics" })
  getGradeStatistics(@Param("id") id: string) {
    return this.gradeQueries.getGradeStatistics(id);
  }
}
