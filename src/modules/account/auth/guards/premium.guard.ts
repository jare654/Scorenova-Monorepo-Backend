import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { CredentialType } from "@libs/common/enums";

/**
 * PremiumGuard — blocks access for non-premium or expired-premium users.
 *
 * Uses a DB lookup (not just the JWT) so that premium grants take effect
 * immediately without requiring the student to re-login.
 *
 * Admins always bypass this guard.
 *
 * Premium is active when:
 *   account.isPremium === true  AND
 *   (account.premiumEndDate is null  OR  account.premiumEndDate > now)
 *
 * Usage:
 *   @UseGuards(PremiumGuard)
 *   @Get("premium-endpoint")
 *   async handler() { ... }
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: UserInfo = request.user;

    // Admins always have full access
    if (user?.type === CredentialType.Admin) {
      return true;
    }

    // DB lookup — reflects the current state even if the JWT is stale
    const account = await this.accountRepo.findOne({
      where: { id: user.id },
      select: ["id", "isPremium", "premiumEndDate"],
    });

    const isPremiumActive =
      account?.isPremium === true &&
      (
        !account.premiumEndDate ||
        new Date(account.premiumEndDate) > new Date()
      );

    if (!isPremiumActive) {
      throw new ForbiddenException({
        code: "PREMIUM_REQUIRED",
        message: "This feature requires an active premium subscription.",
        upgrade: {
          title: "Premium Feature",
          description: "Upgrade to Premium to unlock:",
          benefits: [
            "All Questions",
            "Unlimited Practice",
            "Mock Exams",
            "Detailed Solutions",
          ],
          contact: "Contact us on Telegram after payment verification.",
        },
      });
    }

    return true;
  }
}
