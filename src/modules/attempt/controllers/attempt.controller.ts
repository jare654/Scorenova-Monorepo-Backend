import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import type { UserInfo } from "@account/auth/dtos/user-info.dto";
import { PremiumGuard } from "@account/auth/guards/premium.guard";
import { CreateExamSessionUsecase } from "../usecases/attempts/create-exam-session.usecase";
import { RecordAttemptsBatchUsecase } from "../usecases/attempts/record-attempts-batch.usecase";
import {
  CreateExamSessionDto,
  RecordAttemptsBatchDto,
} from "../usecases/attempts/attempt.commands";
import {
  CreateExamSessionResponseDto,
  RecordAttemptsBatchResponseDto,
} from "../usecases/attempts/attempt.response";

@ApiTags("attempts")
@ApiBearerAuth("Bearer")
@Controller("attempts")
export class AttemptController {
  constructor(
    private readonly createExamSessionUsecase: CreateExamSessionUsecase,
    private readonly recordBatchUsecase: RecordAttemptsBatchUsecase,
  ) {}

  @Post("sessions")
  @ApiOperation({
    summary: "Start an exam session",
    description:
      "Creates a session scoped to a subject. Use the returned sessionId when recording attempts.",
  })
  async createSession(
    @CurrentUser() user: UserInfo,
    @Body() body: CreateExamSessionDto,
  ): Promise<CreateExamSessionResponseDto> {
    return this.createExamSessionUsecase.run(user.id, body);
  }

  @Post("batch")
  @UseGuards(PremiumGuard)
  @ApiOperation({
    summary: "Record attempts in batch (Premium only)",
    description:
      "Inserts multiple attempt rows for a session. subject_id is stored on each row (from the session). Duplicate question IDs in the same session are skipped. Requires an active premium subscription.",
  })
  async recordBatchAttempts(
    @CurrentUser() user: UserInfo,
    @Body() body: RecordAttemptsBatchDto,
  ): Promise<RecordAttemptsBatchResponseDto> {
    return this.recordBatchUsecase.run(user.id, body);
  }
}
