import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubjectEntity } from "../subject/models/subjects/subject.entity";
import { QuestionEntity } from "../question/models/questions/question.entity";
import { ExamSessionEntity } from "./models/sessions/exam-session.entity";
import { AttemptEntity } from "./models/attempts/attempt.entity";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { MockExamResultEntity } from "../mock/models/mock-exam-result.entity";
import { TopicEntity } from "../topic/models/topics/topic.entity";
import { AttemptController } from "./controllers/attempt.controller";
import { ProgressController } from "./controllers/progress.controller";
import { CreateExamSessionUsecase } from "./usecases/attempts/create-exam-session.usecase";
import { RecordAttemptsBatchUsecase } from "./usecases/attempts/record-attempts-batch.usecase";
import { PremiumGuard } from "../account/auth/guards/premium.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamSessionEntity,
      AttemptEntity,
      SubjectEntity,
      QuestionEntity,
      AccountEntity,
      MockExamResultEntity,
      TopicEntity,
    ]),
  ],
  controllers: [AttemptController, ProgressController],
  providers: [CreateExamSessionUsecase, RecordAttemptsBatchUsecase, PremiumGuard],
  exports: [TypeOrmModule, CreateExamSessionUsecase, RecordAttemptsBatchUsecase],
})
export class AttemptModule {}
