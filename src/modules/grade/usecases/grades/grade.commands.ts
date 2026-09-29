import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateGradeDto {
  @ApiProperty({ example: "Grade 12" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name: string;

  @ApiProperty({ required: false, example: "Grade 12 Senior Secondary Curriculum" })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateGradeDto {
  @ApiProperty({ example: "Grade 12" })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  name?: string;

  @ApiProperty({ required: false, example: "Grade 12 Senior Secondary Curriculum" })
  @IsString()
  @IsOptional()
  description?: string;
}
