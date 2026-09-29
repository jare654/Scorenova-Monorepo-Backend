import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { QuestionDifficulty } from "../../models/questions/question.entity";

export class CreateQuestionDto {
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsUUID()
  @IsNotEmpty()
  topicId: string;

  @ApiProperty({ example: "What is the main function of red blood cells?" })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ type: [String], example: ["Transport oxygen", "Synthesize proteins", "Digest cellular waste", "Produce hormones"] })
  @IsArray()
  @IsOptional()
  options?: string[];

  @ApiProperty({ example: "Transport oxygen" })
  @IsString()
  @IsNotEmpty()
  correctAnswer: string;

  @ApiProperty({ enum: QuestionDifficulty, default: QuestionDifficulty.Medium, example: QuestionDifficulty.Medium })
  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;

  @ApiProperty({ required: false, example: "Red blood cells contain hemoglobin, which binds oxygen for transport throughout the body." })
  @IsString()
  @IsOptional()
  explanation?: string;
}

export class UpdateQuestionDto {
  @ApiProperty({ required: false, example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiProperty({ required: false, example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsUUID()
  @IsOptional()
  topicId?: string;

  @ApiProperty({ required: false, example: "What is the main function of red blood cells?" })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiProperty({ type: [String], required: false, example: ["Transport oxygen", "Synthesize proteins", "Digest cellular waste", "Produce hormones"] })
  @IsArray()
  @IsOptional()
  options?: string[];

  @ApiProperty({ required: false, example: "Transport oxygen" })
  @IsString()
  @IsOptional()
  correctAnswer?: string;

  @ApiProperty({ enum: QuestionDifficulty, required: false, example: QuestionDifficulty.Medium })
  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;

  @ApiProperty({ required: false, example: "Red blood cells contain hemoglobin, which binds oxygen for transport throughout the body." })
  @IsString()
  @IsOptional()
  explanation?: string;
}

export class BulkDeleteQuestionsDto {
  @ApiProperty({ type: [String], example: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  ids: string[];
}
