import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsUUID, Min, Max, IsInt, IsString } from "class-validator";
import { QuestionDifficulty } from "../../models/questions/question.entity";

const toBoolean = (v: unknown) =>
  v === "true" || v === true || v === "1" || v === 1;

export class QuestionQueryDto {
  @ApiPropertyOptional({
    description: "Filter by stream ID (questions from subjects in this stream)",
    example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  })
  @IsOptional()
  @IsUUID()
  streamId?: string;

  @ApiPropertyOptional({ description: "Filter by subject ID (comma-separated for multiple)", example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: "Filter by topic ID", example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @ApiPropertyOptional({
    enum: QuestionDifficulty,
    description: "Filter by difficulty level",
    example: QuestionDifficulty.Medium,
  })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ description: "Full-text search on question text", example: "mitochondria" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Page number (1-based)", default: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => (value != null ? Number(value) : 1))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page (max 50)", default: 10, example: 10 })
  @IsOptional()
  @Transform(({ value }) => (value != null ? Number(value) : 10))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Return questions in random order",
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  random?: boolean = false;

  @ApiPropertyOptional({
    description: "Include explanation text in response",
    default: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  withExplanation?: boolean = false;
}
