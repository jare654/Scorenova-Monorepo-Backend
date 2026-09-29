import { AllowAnonymous } from "@account/auth/decorators/allow-anonymous.decorator";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class CronService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  @AllowAnonymous()
  async checkLeasePayments() {
    this.eventEmitter.emit("check-due-lease-payments");
  }

  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  @AllowAnonymous()
  async checkOwnerPayments() {
    this.eventEmitter.emit("check-due-owner-payments");
  }

  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  @AllowAnonymous()
  async increaseRent() {
    this.eventEmitter.emit("run.scheduled.rent.increase");
  }
}
