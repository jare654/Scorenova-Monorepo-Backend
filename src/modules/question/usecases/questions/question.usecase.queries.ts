import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QuestionEntity } from "../../models/questions/question.entity";
import { AttemptEntity } from "../../../attempt/models/attempts/attempt.entity";
import { QuestionQueryDto } from "./question-query.dto";
import { QuestionListResponseDto } from "./question.response";

@Injectable()
export class QuestionQueries {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
  ) {}

  async findQuestions(
    query: QuestionQueryDto,
    isPremium = false,
    freeSubjectId: string | null = null,
  ): Promise<QuestionListResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;
    const withExplanation = query.withExplanation === true;

    const qb = this.questionRepo
      .createQueryBuilder("q")
      .leftJoinAndSelect("q.subject", "subject")
      .leftJoinAndSelect("q.topic", "topic");

    // ── Stream filter — join through subject.streamId ──────────────────────
    // Use a subquery instead of innerJoin to avoid TypeORM's DISTINCT pagination
    // issue where ORDER BY columns must appear in the distinct select list.
    if (query.streamId) {
      qb.andWhere(
        `q.subjectId IN (
          SELECT s.id FROM subjects s
          WHERE s.stream_id = :streamId OR s.stream_id IS NULL
        )`,
        { streamId: query.streamId },
      );
    }

    if (query.subjectId) {
      // Support comma-separated subject IDs for subjects that span multiple streams
      // e.g. Aptitude exists under both Natural and Social Science
      const ids = query.subjectId.split(",").map((id) => id.trim()).filter(Boolean);
      if (ids.length === 1) {
        qb.andWhere("q.subjectId = :subjectId", { subjectId: ids[0] });
      } else {
        qb.andWhere("q.subjectId IN (:...subjectIds)", { subjectIds: ids });
      }
    }

    if (query.topicId) {
      qb.andWhere("q.topicId = :topicId", { topicId: query.topicId });
    }

    if (query.difficulty) {
      qb.andWhere("q.difficulty = :difficulty", {
        difficulty: query.difficulty,
      });
    }

    if (query.search?.trim()) {
      qb.andWhere("q.text ILIKE :search", {
        search: `%${query.search.trim()}%`,
      });
    }

    const total = await qb.getCount();

    if (query.random) {
      qb.orderBy("RANDOM()");
    } else {
      qb.orderBy("q.createdAt", "DESC");
    }

    qb.skip(skip).take(limit);

    const items = await qb.getMany();

    // ── Free-preview strategy ─────────────────────────────────────────────
    // Premium users: all questions fully unlocked.
    // Free subject / free topic: configured in database or settings — all questions unlocked.

    const data = items.map((q) => {
      // Unlock if: premium user, OR this question belongs to a free subject / topic
      const isFreeSubject =
        (!!freeSubjectId && q.subjectId === freeSubjectId) ||
        q.subject?.isFree === true ||
        q.topic?.isFree === true;
      const isFreePreview = isPremium || isFreeSubject;

      if (isFreePreview) {
        return {
          id:            q.id,
          text:          q.text,
          options:       q.options,
          correctAnswer: q.correctAnswer,
          correctIndex:  q.options ? q.options.indexOf(q.correctAnswer) : -1,
          difficulty:    q.difficulty,
          subjectId:     q.subjectId,
          subjectName:   q.subject?.name ?? null,
          topicId:       q.topicId,
          topicName:     q.topic?.name ?? null,
          isFreePreview: true,
          ...(withExplanation && { explanation: q.explanation ?? null }),
        };
      }

      // Locked — still return choices/options so mobile can render the blur overlay
      // The mobile app uses isFreePreview=false as the signal to show the paywall
      // correctIndex is hidden (-1) so the correct answer cannot be extracted
      return {
        id:            q.id,
        text:          q.text,
        options:       q.options,   // choices visible — mobile blurs them
        correctIndex:  -1,          // correct answer hidden
        difficulty:    q.difficulty,
        subjectId:     q.subjectId,
        subjectName:   q.subject?.name ?? null,
        topicId:       q.topicId,
        topicName:     q.topic?.name ?? null,
        isFreePreview: false,
        ...(withExplanation && { explanation: null }),
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getStatistics() {
    const totalQuestions = await this.questionRepo.count();

    const [bySubject, byTopic, byDifficulty] = await Promise.all([
      this.questionRepo
        .createQueryBuilder("q")
        .select("q.subjectId", "subjectId")
        .addSelect("COUNT(*)", "count")
        .groupBy("q.subjectId")
        .getRawMany(),

      this.questionRepo
        .createQueryBuilder("q")
        .select("q.topicId", "topicId")
        .addSelect("COUNT(*)", "count")
        .groupBy("q.topicId")
        .getRawMany(),

      this.questionRepo
        .createQueryBuilder("q")
        .select("q.difficulty", "difficulty")
        .addSelect("COUNT(*)", "count")
        .groupBy("q.difficulty")
        .getRawMany(),
    ]);

    const totalAttempts = await this.attemptRepo.count();
    const correctAttempts = await this.attemptRepo.count({
      where: { isCorrect: true },
    });
    const correctRate = totalAttempts
      ? Number((correctAttempts / totalAttempts).toFixed(4))
      : 0;

    return {
      totalQuestions,
      bySubject,
      byTopic,
      byDifficulty,
      attempts: {
        total: totalAttempts,
        correct: correctAttempts,
        incorrect: totalAttempts - correctAttempts,
        correctRate,
      },
    };
  }

  async getSingleQuestionStatistics(questionId: string) {
    const [totalAttempts, correctAnswers, averageRaw] = await Promise.all([
      this.attemptRepo.count({ where: { questionId } }),
      this.attemptRepo.count({ where: { questionId, isCorrect: true } }),
      this.attemptRepo
        .createQueryBuilder("attempt")
        .select("AVG(attempt.timeSpentMs)", "avgTime")
        .where("attempt.questionId = :questionId", { questionId })
        .getRawOne(),
    ]);

    const averageTimeSeconds = averageRaw?.avgTime
      ? Math.round(Number(averageRaw.avgTime) / 1000)
      : 0;
    const successRate = totalAttempts
      ? Math.round((correctAnswers / totalAttempts) * 100)
      : 0;

    return { totalAttempts, correctAnswers, averageTimeSeconds, successRate };
  }
}
