import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateTopicDto {
  @ApiProperty({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ example: "Cell Structure and Function" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false, example: "Overview of organelles, cell membranes, and cellular respiration processes." })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 45, description: "Topic exam duration in minutes" })
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ description: "Whether topic is free for all users", example: false })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "paid", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

export class UpdateTopicDto {
  @ApiProperty({ required: false, example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiProperty({ required: false, example: "Cell Structure and Function" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, example: "Overview of organelles, cell membranes, and cellular respiration processes." })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 45, description: "Topic exam duration in minutes" })
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ description: "Whether topic is free for all users", example: true })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "free", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

export class UpdateTopicAccessDto {
  @ApiPropertyOptional({ description: "Whether topic is free for all users", example: true })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "free", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

