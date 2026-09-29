import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { NotificationService } from "../../notification/notification.service";

/**
 * Runs daily at midnight to expire premium subscriptions whose end date has passed.
 * Sets isPremium=false so the next login produces a token with isPremium=false,
 * and the PremiumGuard DB-lookup path also reflects the correct state.
 * Also sends a push notification to each expired user.
 */
@Injectable()
export class PremiumExpiryService {
  private readonly logger = new Logger(PremiumExpiryService.name);

  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireStaleSubscriptions(): Promise<void> {
    const now = new Date();

    // Fetch accounts that need expiring so we can notify each one
    const expiring = await this.accountRepo.find({
      where: {
        isPremium: true,
        premiumEndDate: LessThan(now),
      },
      select: ["id", "fcmId"],
    });

    if (expiring.length === 0) return;

    // Bulk update
    await this.accountRepo
      .createQueryBuilder()
      .update(AccountEntity)
      .set({ isPremium: false })
      .where("is_premium = true AND premium_end_date IS NOT NULL AND premium_end_date < :now", { now })
      .execute();

    this.logger.log(`Premium expiry job: expired ${expiring.length} subscription(s)`);

    // Send push notification to each expired user (fire-and-forget)
    for (const account of expiring) {
      this.notificationService
        .sendToUser(
          account.id,
          "Premium Subscription Expired",
          "Your premium subscription has expired. Renew now to keep access to all features.",
          account.fcmId ?? undefined,
        )
        .catch(() => {/* non-critical */});
    }
  }
}
