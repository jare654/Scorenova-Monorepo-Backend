import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TopicEntity } from "./models/topics/topic.entity";
import { TopicController } from "./controllers/topic.controller";
import { TopicQueries } from "./usecases/topics/topic.usecase.queries";
import { TopicCommands } from "./usecases/topics/topic.usecase.commands";

@Module({
  imports: [
    TypeOrmModule.forFeature([TopicEntity]),
  ],
  controllers: [TopicController],
  providers: [TopicQueries, TopicCommands],
  exports: [TypeOrmModule, TopicQueries, TopicCommands],
})
export class TopicModule {}
