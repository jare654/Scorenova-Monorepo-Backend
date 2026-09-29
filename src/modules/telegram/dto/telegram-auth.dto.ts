import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class TelegramAuthDto {
  @IsString()
  @IsNotEmpty()
  initData: string;
}

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  initData: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  streamId: string;

  @IsString()
  @IsOptional()
  gender?: string;
}
