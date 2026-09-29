import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FeedbackEntity } from "./models/feedback.entity";
import { UserReportEntity } from "./models/user-report.entity";
import { FeedbackController } from "./controllers/feedback.controller";
import { ReportController } from "./controllers/report.controller";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([FeedbackEntity, UserReportEntity, AccountEntity]),
    NotificationModule,
  ],
  controllers: [FeedbackController, ReportController],
  providers: [],
  exports: [TypeOrmModule],
})
export class FeedbackModule {}
