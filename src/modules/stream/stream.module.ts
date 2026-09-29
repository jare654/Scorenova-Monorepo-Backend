import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StreamEntity } from "./models/streams/stream.entity";
import { StreamController } from "./controllers/stream.controller";
import { StreamQueries } from "./usecases/streams/stream.usecase.queries";

@Module({
  imports: [TypeOrmModule.forFeature([StreamEntity])],
  controllers: [StreamController],
  providers: [StreamQueries],
  exports: [TypeOrmModule, StreamQueries],
})
export class StreamModule {}
