import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { NotificationEntity } from "./models/notification.entity";
import { TempDeviceTokenEntity } from "./models/temp-device-token.entity";
import { NotificationController } from "./controllers/notification.controller";
import { NotificationService } from "./notification.service";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { OtpEntity } from "../account/models/otp/otp.entity";
import { AttemptEntity } from "../attempt/models/attempts/attempt.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      AccountEntity,
      TempDeviceTokenEntity,
      OtpEntity,
      AttemptEntity,
    ]),
    ScheduleModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}



