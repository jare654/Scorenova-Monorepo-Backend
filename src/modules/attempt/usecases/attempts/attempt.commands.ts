import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateExamSessionDto {
  @ApiProperty({ description: "Subject UUID for this practice session", example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;
}

export class AttemptItemDto {
  @ApiProperty({ example: "f47ac10b-58cc-4372-a567-0e02b2c3d479" })
  @IsUUID()
  questionId: string;

  @ApiProperty({ example: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" })
  @IsUUID()
  topicId: string;

  @ApiProperty({ description: "Selected option index or value (must match question storage)", example: "0" })
  @IsString()
  @IsNotEmpty()
  selectedAnswer: string;

  @ApiProperty({ description: "Time spent on this question in milliseconds", example: 45000 })
  @IsInt()
  @Min(0)
  timeSpentMs: number;
}

export class RecordAttemptsBatchDto {
  @ApiProperty({ example: "d02dd06f-2a30-4ed8-a2a0-75c683e3092e" })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ type: [AttemptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttemptItemDto)
  attempts: AttemptItemDto[];
}
