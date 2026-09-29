import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GradeEntity } from "./models/grades/grade.entity";
import { GradeController } from "./controllers/grade.controller";
import { GradeQueries } from "./usecases/grades/grade.usecase.queries";
import { GradeCommands } from "./usecases/grades/grade.usecase.commands";

@Module({
  imports: [TypeOrmModule.forFeature([GradeEntity])],
  controllers: [GradeController],
  providers: [GradeQueries, GradeCommands],
  exports: [TypeOrmModule, GradeQueries, GradeCommands],
})
export class GradeModule {}
