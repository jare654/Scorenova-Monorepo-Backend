import { Public } from '@account/auth/decorators/public.decorator';
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TelegramAuthService } from '../services/telegram-auth.service';
import { TelegramAuthDto, CompleteProfileDto } from '../dto/telegram-auth.dto';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramAuthService: TelegramAuthService) {}

  @Public()
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  async authenticate(@Body() dto: TelegramAuthDto) {
    return this.telegramAuthService.authenticate(dto.initData);
  }

  @Public()
  @Post('auth/complete-profile')
  @HttpCode(HttpStatus.OK)
  async completeProfile(@Body() dto: CompleteProfileDto) {
    return this.telegramAuthService.completeProfile(
      dto.initData,
      dto.name,
      dto.streamId,
      dto.gender
    );
  }
}
