import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateSubjectDto {
  @ApiProperty({ description: "Stream ID", example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsUUID()
  streamId: string;

  @ApiProperty({ example: "Biology" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false, example: "Grade 11 and 12 Biology curriculum covering Cell Biology, Genetics, and Ecology." })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: "Whether subject is free for all users", example: false })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "paid", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

export class UpdateSubjectDto {
  @ApiProperty({ required: false, example: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22" })
  @IsUUID()
  @IsOptional()
  streamId?: string;

  @ApiProperty({ required: false, example: "Biology" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, example: "Grade 11 and 12 Biology curriculum covering Cell Biology, Genetics, and Ecology." })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: "Whether subject is free for all users", example: true })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "free", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

export class UpdateSubjectAccessDto {
  @ApiPropertyOptional({ description: "Whether subject is free for all users", example: true })
  @IsBoolean()
  @IsOptional()
  isFree?: boolean;

  @ApiPropertyOptional({ description: "Access type: free or paid", example: "free", enum: ["free", "paid"] })
  @IsString()
  @IsOptional()
  @IsIn(["free", "paid"])
  accessType?: string;
}

