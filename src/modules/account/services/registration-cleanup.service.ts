import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, In } from "typeorm";
import { AccountEntity } from "../models/accounts/account.entity";

/**
 * Cleans up abandoned in-progress registrations.
 *
 * Accounts stuck in 'pending_details' or 'pending_password' for more than 48 hours
 * are permanently deleted. This ensures phone numbers from incomplete registrations
 * are released and can be re-used (SIM reassignment, typo correction, etc.).
 *
 * Runs every hour so the window between expiry and cleanup is at most 1 hour.
 */
@Injectable()
export class RegistrationCleanupService {
  private readonly logger = new Logger(RegistrationCleanupService.name);
  private readonly ABANDONED_THRESHOLD_HOURS = 48;

  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupAbandonedRegistrations(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.ABANDONED_THRESHOLD_HOURS * 60 * 60 * 1000,
    );

    try {
      const result = await this.accountRepo.delete({
        status: In(["pending_details", "pending_password"]),
        createdAt: LessThan(cutoff),
      });

      if ((result.affected ?? 0) > 0) {
        this.logger.log(
          `Cleaned up ${result.affected} abandoned registration(s) older than ${this.ABANDONED_THRESHOLD_HOURS}h`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Registration cleanup failed: ${msg}`);
    }
  }
}
