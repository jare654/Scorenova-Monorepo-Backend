import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateStreamDto {
  @ApiProperty({ example: "Natural Science" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, example: "Natural Science academic stream including Physics, Chemistry, Biology, and Math." })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateStreamDto {
  @ApiProperty({ required: false, example: "Natural Science" })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false, example: "Natural Science academic stream including Physics, Chemistry, Biology, and Math." })
  @IsString()
  @IsOptional()
  description?: string;
}
