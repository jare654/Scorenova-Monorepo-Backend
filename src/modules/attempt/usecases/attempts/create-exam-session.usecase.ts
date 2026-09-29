import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SubjectEntity } from "../../../subject/models/subjects/subject.entity";
import { ExamSessionEntity } from "../../models/sessions/exam-session.entity";
import type { CreateExamSessionDto } from "./attempt.commands";
import type { CreateExamSessionResponseDto } from "./attempt.response";

@Injectable()
export class CreateExamSessionUsecase {
  constructor(
    @InjectRepository(ExamSessionEntity)
    private readonly sessionRepo: Repository<ExamSessionEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
  ) {}

  async run(
    accountId: string,
    dto: CreateExamSessionDto,
  ): Promise<CreateExamSessionResponseDto> {
    const subject = await this.subjectRepo.findOne({
      where: { id: dto.subjectId },
    });
    if (!subject) {
      throw new NotFoundException("Subject not found");
    }

    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        accountId,
        subjectId: dto.subjectId,
      }),
    );

    return {
      sessionId: session.id,
      subjectId: session.subjectId,
      createdAt: session.createdAt,
    };
  }
}
