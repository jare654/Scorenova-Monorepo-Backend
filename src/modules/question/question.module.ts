import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { QuestionEntity } from "./models/questions/question.entity";
import { QuestionExplanationEntity } from "./models/question-explanation.entity";
import { SavedQuestionEntity } from "./models/saved-question.entity";
import { QuestionFlagEntity } from "./models/question-flag.entity";

import { QuestionController } from "./controllers/question.controller";
import { SavedFlagController } from "./controllers/saved-flag.controller";

import { QuestionQueries } from "./usecases/questions/question.usecase.queries";
import { QuestionCommands } from "./usecases/questions/question.usecase.commands";
import { ExplanationService } from "./services/explanation.service";
import { BulkUploadService } from "./services/bulk-upload.service";

import { AttemptModule } from "../attempt/attempt.module";
import { AttemptEntity } from "../attempt/models/attempts/attempt.entity";
import { SubjectEntity } from "../subject/models/subjects/subject.entity";
import { TopicEntity } from "../topic/models/topics/topic.entity";
import { StreamEntity } from "../stream/models/streams/stream.entity";
import { AiModule } from "../ai/ai.module";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { PremiumGuard } from "../account/auth/guards/premium.guard";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuestionEntity,
      QuestionExplanationEntity,
      SavedQuestionEntity,
      QuestionFlagEntity,
      AttemptEntity,
      SubjectEntity,
      TopicEntity,
      StreamEntity,
      AccountEntity,
    ]),
    AttemptModule,
    AiModule,
    SettingsModule,
  ],
  controllers: [QuestionController, SavedFlagController],
  providers: [
    QuestionQueries,
    QuestionCommands,
    ExplanationService,
    BulkUploadService,
    PremiumGuard,
  ],
  exports: [
    TypeOrmModule,
    QuestionQueries,
    QuestionCommands,
    ExplanationService,
    BulkUploadService,
  ],
})
export class QuestionModule {}
