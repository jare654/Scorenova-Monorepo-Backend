import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubjectEntity } from "./models/subjects/subject.entity";
import { StreamEntity } from "../stream/models/streams/stream.entity";
import { SubjectController } from "./controllers/subject.controller";
import { SubjectQueries } from "./usecases/subjects/subject.usecase.queries";
import { SubjectCommands } from "./usecases/subjects/subject.usecase.commands";
import { TopicEntity } from "../topic/models/topics/topic.entity";

@Module({
  imports: [TypeOrmModule.forFeature([SubjectEntity, StreamEntity, TopicEntity])],
  controllers: [SubjectController],
  providers: [SubjectQueries, SubjectCommands],
  exports: [TypeOrmModule, SubjectQueries, SubjectCommands],
})
export class SubjectModule {}
