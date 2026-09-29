import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";
import { FilterOperators } from "./filter_operators";
export class CollectionQuery {
  @ApiPropertyOptional()
  @IsOptional()
  top?: number;

  @ApiPropertyOptional()
  @IsOptional()
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  orderBy?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  searchFrom?: any;

  @ApiPropertyOptional()
  @IsOptional()
  filter?: any;

  @ApiPropertyOptional()
  @IsOptional()
  includes?: any;

  @ApiPropertyOptional()
  @IsOptional()
  select?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  groupBy?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  count?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  withArchived?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stream?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
enum Direction {
  ASC = "ASC",
  DESC = "DESC",
}
export class Order {
  @ApiProperty()
  @IsString()
  field?: string;
  @ApiProperty()
  @IsEnum(Direction, {
    message: "Direction must be either ASC or DESC",
  })
  direction?: string;
}

export class Filter {
  @ApiProperty()
  @IsString()
  field!: string;
  @ApiProperty()
  @IsString()
  value?: any;
  @ApiProperty()
  @IsEnum(FilterOperators, {
    message: `Operator must be one of ${Object.keys(
      FilterOperators
    ).toString()}`,
  })
  operator?: string;
}
