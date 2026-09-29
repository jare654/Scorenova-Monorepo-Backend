import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MockController } from "./controllers/mock.controller";
import { MockExamEntity } from "./models/mock-exam.entity";
import { MockExamResultEntity } from "./models/mock-exam-result.entity";
import { MockExplanationEntity } from "./models/mock-explanation.entity";
import { SubjectEntity } from "../subject/models/subjects/subject.entity";
import { TopicEntity } from "../topic/models/topics/topic.entity";
import { StreamEntity } from "../stream/models/streams/stream.entity";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { AttemptModule } from "../attempt/attempt.module";
import { AiModule } from "../ai/ai.module";
import { GenerateMockExamUsecase } from "./usecases/generate-mock-exam.usecase";
import { MockExplanationService } from "./services/mock-explanation.service";
import { PremiumGuard } from "../account/auth/guards/premium.guard";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MockExamEntity,
      MockExamResultEntity,
      MockExplanationEntity,
      SubjectEntity,
      TopicEntity,
      StreamEntity,
      AccountEntity,
    ]),
    AttemptModule,
    AiModule,
    SettingsModule,
  ],
  controllers: [MockController],
  providers: [GenerateMockExamUsecase, MockExplanationService, PremiumGuard],
  exports: [TypeOrmModule],
})
export class MockModule {}
