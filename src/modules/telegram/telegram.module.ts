import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramController } from './controllers/telegram.controller';
import { TelegramAuthService } from './services/telegram-auth.service';
import { AccountEntity as Account } from '../account/models/accounts/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'secret',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TelegramController],
  providers: [TelegramAuthService],
  exports: [TelegramAuthService],
})
export class TelegramModule {}
