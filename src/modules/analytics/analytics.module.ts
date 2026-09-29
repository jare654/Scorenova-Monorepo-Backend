import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnalyticsController } from "./controllers/analytics.controller";
import { AnalyticsQueries } from "./usecases/analytics.queries";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { QuestionEntity } from "../question/models/questions/question.entity";
import { AttemptEntity } from "../attempt/models/attempts/attempt.entity";
import { SubjectEntity } from "../subject/models/subjects/subject.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      QuestionEntity,
      AttemptEntity,
      SubjectEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsQueries],
  exports: [AnalyticsQueries],
})
export class AnalyticsModule { }
