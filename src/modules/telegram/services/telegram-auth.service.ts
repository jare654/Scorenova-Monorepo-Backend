import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity as Account } from '../../account/models/accounts/account.entity';
import { validate } from '@tma.js/init-data-node';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramAuthService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async authenticate(initData: string) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new InternalServerErrorException('Telegram bot token not configured');
    }

    try {
      // Validate the initData signature
      validate(initData, botToken);
    } catch (e) {
      throw new UnauthorizedException('Invalid Telegram authentication data');
    }

    // Parse initData to extract user info
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) throw new UnauthorizedException('No user data in initData');
    
    const user = JSON.parse(userStr);
    const telegramId = user.id;

    // Check if user exists
    let account = await this.accountRepository.findOne({ where: { telegramId } });

    if (!account) {
      return { status: 'new_user', telegramId };
    }

    // Generate tokens
    return this.generateTokens(account);
  }

  async completeProfile(initData: string, name: string, streamId: string, phoneNumber: string, gender?: string) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    
    try {
      validate(initData, botToken);
    } catch (e) {
      throw new UnauthorizedException('Invalid Telegram authentication data');
    }

    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    const user = JSON.parse(userStr!);
    
    // Create new account
    
    // Validate streamId is a uuid, otherwise set to null
    const isValidUuid = streamId && streamId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const account = this.accountRepository.create({
      name,
      telegramId: user.id,
      telegramUsername: user.username,
      telegramPhotoUrl: user.photo_url,
      streamId: isValidUuid ? streamId : null,
      gender,
      phoneNumber,
      username: user.username, // Dummy phone number for Telegram users
      type: 'student',
      isActive: true,
      isPremium: false,
    });

    await this.accountRepository.save(account);

    return this.generateTokens(account);
  }

  private generateTokens(account: Account) {
    const payload = { sub: account.id, type: account.type };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '30d' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '36500d' });

    return {
      status: 'authenticated',
      accessToken,
      refreshToken,
      user: account,
    };
  }
}
