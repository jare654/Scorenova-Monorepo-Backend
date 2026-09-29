import { ApiProperty } from "@nestjs/swagger";

export class CreateExamSessionResponseDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  createdAt: Date;
}

export class RecordAttemptsBatchResponseDto {
  @ApiProperty({ description: "Number of rows inserted" })
  inserted: number;

  @ApiProperty({
    description: "Question IDs skipped (already recorded for this session)",
    type: [String],
  })
  skippedDuplicateQuestionIds: string[];

  @ApiProperty({ type: [String] })
  attemptIds: string[];
}
