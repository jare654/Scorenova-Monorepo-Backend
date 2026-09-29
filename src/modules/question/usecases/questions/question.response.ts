import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { QuestionDifficulty } from "../../models/questions/question.entity";

export class QuestionItemDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  text: string;
  @ApiProperty({ type: [String], nullable: true })
  options: string[] | null;
  @ApiProperty()
  correctIndex: number;
  @ApiProperty({ enum: QuestionDifficulty })
  difficulty: QuestionDifficulty;
  @ApiPropertyOptional()
  explanation?: string | null;
  @ApiProperty()
  subjectId: string;
  @ApiProperty()
  topicId: string;
  @ApiProperty({
    description: "True = full question shown to user. False = blurred/locked (premium only).",
  })
  isFreePreview: boolean;
}

export class QuestionListResponseDto {
  @ApiProperty({ type: [QuestionItemDto] })
  data: QuestionItemDto[];
  @ApiProperty()
  total: number;
  @ApiProperty()
  page: number;
  @ApiProperty()
  limit: number;
  @ApiProperty()
  totalPages: number;
}
