import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class ExplainRequestDto {
  @ApiPropertyOptional({ description: "The question text", example: "What is the primary function of mitochondria?" })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiPropertyOptional({ description: "The correct answer", example: "ATP Production" })
  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @ApiPropertyOptional({ description: "The answer selected by user (mobile app field)", example: "ATP Production" })
  @IsOptional()
  @IsString()
  selectedAnswer?: string;

  @ApiPropertyOptional({ description: "Whether selected answer was correct (mobile app field)", example: true })
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @ApiPropertyOptional({ description: "Subject name (e.g. Maths, Biology)", example: "Biology" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: "Topic name (e.g. Algebra, Cell Basics)", example: "Cell Structure and Function" })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ type: [String], example: ["ATP Production", "Protein Synthesis", "DNA Replication", "Lipid Storage"] })
  @IsOptional()
  @IsArray()
  options?: string[];
}
