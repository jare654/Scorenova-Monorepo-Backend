import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { QuestionEntity } from "../../../question/models/questions/question.entity";
import { AttemptEntity } from "../../models/attempts/attempt.entity";
import { ExamSessionEntity } from "../../models/sessions/exam-session.entity";
import type { RecordAttemptsBatchDto } from "./attempt.commands";
import type { RecordAttemptsBatchResponseDto } from "./attempt.response";

@Injectable()
export class RecordAttemptsBatchUsecase {
  constructor(
    @InjectRepository(ExamSessionEntity)
    private readonly sessionRepo: Repository<ExamSessionEntity>,
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
  ) {}

  async run(
    accountId: string,
    dto: RecordAttemptsBatchDto,
  ): Promise<RecordAttemptsBatchResponseDto> {
    const session = await this.sessionRepo.findOne({
      where: { id: dto.sessionId, accountId },
    });
    if (!session) {
      throw new NotFoundException("Session not found or does not belong to you");
    }

    const subjectId = session.subjectId;
    const questionIds = [...new Set(dto.attempts.map((a) => a.questionId))];

    const existing = await this.attemptRepo.find({
      where: {
        sessionId: session.id,
        questionId: In(questionIds),
      },
      select: ["questionId"],
    });
    const alreadyDone = new Set(existing.map((e) => e.questionId));

    const questions = await this.questionRepo.find({
      where: { id: In(questionIds) },
    });
    const questionById = new Map(questions.map((q) => [q.id, q]));

    const rows: Partial<AttemptEntity>[] = [];
    const skippedDuplicateQuestionIds: string[] = [];
    const seenInPayload = new Set<string>();

    for (const item of dto.attempts) {
      if (seenInPayload.has(item.questionId)) {
        skippedDuplicateQuestionIds.push(item.questionId);
        continue;
      }
      seenInPayload.add(item.questionId);

      if (alreadyDone.has(item.questionId)) {
        skippedDuplicateQuestionIds.push(item.questionId);
        continue;
      }

      const q = questionById.get(item.questionId);
      if (!q) {
        throw new BadRequestException(`Question not found: ${item.questionId}`);
      }
      if (q.subjectId !== subjectId) {
        throw new BadRequestException(
          `Question ${item.questionId} does not belong to the session subject`,
        );
      }
      if (q.topicId !== item.topicId) {
        throw new BadRequestException(
          `Topic mismatch for question ${item.questionId}`,
        );
      }

      const isCorrect =
        String(q.correctAnswer).trim() === String(item.selectedAnswer).trim();

      rows.push({
        sessionId: session.id,
        accountId,
        subjectId,
        questionId: item.questionId,
        topicId: item.topicId,
        selectedAnswer: item.selectedAnswer,
        isCorrect,
        timeSpentMs: item.timeSpentMs,
      });
    }

    if (rows.length === 0) {
      return {
        inserted: 0,
        skippedDuplicateQuestionIds,
        attemptIds: [],
      };
    }

    await this.attemptRepo
      .createQueryBuilder()
      .insert()
      .into(AttemptEntity)
      .values(rows)
      .execute();

    const saved = await this.attemptRepo.find({
      where: {
        sessionId: session.id,
        questionId: In(rows.map((r) => r.questionId)),
      },
      select: ["id", "questionId"],
      order: { createdAt: "ASC" },
    });

    return {
      inserted: rows.length,
      skippedDuplicateQuestionIds,
      attemptIds: saved.map((s) => s.id),
    };
  }
}
