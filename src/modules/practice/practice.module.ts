import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PracticeController } from "./controllers/practice.controller";
import { SubjectEntity } from "../subject/models/subjects/subject.entity";
import { TopicEntity } from "../topic/models/topics/topic.entity";
import { QuestionEntity } from "../question/models/questions/question.entity";
import { AccountEntity } from "../account/models/accounts/account.entity";
import { StreamEntity } from "../stream/models/streams/stream.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubjectEntity,
      TopicEntity,
      QuestionEntity,
      AccountEntity,
      StreamEntity,
    ]),
  ],
  controllers: [PracticeController],
})
export class PracticeModule {}
