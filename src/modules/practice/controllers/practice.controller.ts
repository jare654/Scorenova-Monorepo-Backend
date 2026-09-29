import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";
import { TopicEntity } from "../../topic/models/topics/topic.entity";
import { QuestionEntity } from "../../question/models/questions/question.entity";
import { AccountEntity } from "../../account/models/accounts/account.entity";
import { StreamEntity } from "../../stream/models/streams/stream.entity";

// ─── Response shapes ──────────────────────────────────────────────────────────

interface SubjectResponse {
  id: string;
  name: string;
  description: string | null;
  streamId: string | null;
  isFree: boolean;
  accessType: string;
  topicCount: number;
}

interface TopicResponse {
  id: string;
  name: string;
  description: string | null;
  durationMinutes?: number | null;
  subjectId: string;
  isFree: boolean;
  accessType: string;
  questionCount: number;
}

interface PracticeQuestion {
  id: string;
  questionText: string;
  choices: string[];
  correctIndex: number;
  difficulty: string;
  explanation: string;
  topicId: string;
  subjectId: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags("practice")
@Controller("practice")
@ApiBearerAuth("Bearer")
export class PracticeController {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(StreamEntity)
    private readonly streamRepo: Repository<StreamEntity>,
  ) {}

  private async resolveStreamId(stream: string): Promise<string | null> {
    if (!stream?.trim()) return null;
    const val = stream.trim();

    // 1. Check known legacy UUIDs
    const legacyMap: Record<string, string> = {
      "5d24102f-a070-4c18-b612-fa070447f158": "Natural Science",
      "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22": "Natural Science",
      "c891ef18-1d77-4861-9bbc-186b4bc96c23": "Social Science",
      "cleebc99-9c0b-4ef8-bb6d-6bb9bd380a33": "Social Science",
    };
    if (legacyMap[val.toLowerCase()]) {
      const entity = await this.streamRepo.findOne({
        where: { name: ILike(legacyMap[val.toLowerCase()]) },
      });
      if (entity) return entity.id;
    }

    // 2. Check if val is already a valid stream UUID in the DB
    try {
      const streamById = await this.streamRepo.findOne({ where: { id: val } });
      if (streamById) return streamById.id;
    } catch (_) {}

    // 3. Normalize name and find by name
    const normalized = this.normalizeStreamName(val);
    const streamEntity = await this.streamRepo.findOne({
      where: { name: ILike(normalized) },
    });
    return streamEntity?.id ?? null;
  }

  private normalizeStreamName(value: string): string {
    const cleaned = value.trim().toLowerCase();
    if (cleaned === "social" || cleaned === "social science") {
      return "Social Science";
    }
    if (cleaned === "natural" || cleaned === "natural science") {
      return "Natural Science";
    }
    return value;
  }

  /**
   * GET /practice/subjects
   * Returns subjects for the authenticated user's stream.
   * Admin accounts (no streamId) get all subjects.
   */
  @Get("subjects")
  @ApiOperation({
    summary: "Get subjects for the current user's stream",
    description:
      "Admin: returns all subjects. Students: filtered by their registered stream.",
  })
  @ApiQuery({
    name: "stream",
    required: false,
    description:
      "Filter by stream name or alias (e.g. Natural, Social, Natural Science, Social Science)",
  })
  async getSubjects(
    @CurrentUser() user: UserInfo,
    @Query("stream") stream?: string,
  ): Promise<SubjectResponse[]> {
    const account = await this.accountRepo.findOne({ where: { id: user.id } });
    const isAdmin = account?.type === "admin";

    // 1. Resolve stream: query param takes precedence, then user streamId, then user type
    let streamId: string | null = null;
    if (stream?.trim()) {
      streamId = await this.resolveStreamId(stream.trim());
    }
    if (!streamId && (account as any)?.streamId) {
      streamId = await this.resolveStreamId((account as any).streamId);
    }
    if (!streamId && (account?.type === "natural" || account?.type === "social")) {
      streamId = await this.resolveStreamId(account.type);
    }
    if (!streamId && (user?.type === "natural" || user?.type === "social")) {
      streamId = await this.resolveStreamId(user.type);
    }

    const qb = this.subjectRepo
      .createQueryBuilder("s")
      .select(["s.id", "s.name", "s.description", "s.streamId", "s.isFree", "s.accessType"])
      .orderBy("s.name", "ASC");

    if (!isAdmin) {
      if (streamId) {
        qb.where("s.streamId = :streamId OR s.streamId IS NULL", { streamId });
      } else {
        const defaultStream = await this.resolveStreamId("Natural Science");
        if (defaultStream) {
          qb.where("s.streamId = :streamId OR s.streamId IS NULL", { streamId: defaultStream });
        }
      }
    } else if (isAdmin && streamId) {
      qb.where("s.streamId = :streamId OR s.streamId IS NULL", { streamId });
    }

    const subjects = await qb.getMany();

    const subjectIds = subjects.map((s) => s.id);
    if (subjectIds.length === 0) return [];

    // Count topics per subject in a single query
    const topicCounts = await this.topicRepo
      .createQueryBuilder("t")
      .select("t.subjectId", "subjectId")
      .addSelect("COUNT(*)", "count")
      .where("t.subjectId IN (:...ids)", { ids: subjectIds })
      .groupBy("t.subjectId")
      .getRawMany();

    const countMap = new Map<string, number>(
      topicCounts.map((r) => [r.subjectId, Number(r.count)]),
    );

    return subjects.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      streamId: s.streamId,
      isFree: s.isFree ?? false,
      accessType: s.accessType ?? (s.isFree ? "free" : "paid"),
      topicCount: countMap.get(s.id) ?? 0,
    }));
  }

  /**
   * GET /practice/subjects/:subjectId/topics
   * Returns all topics under a given subject.
   */
  @Get("subjects/:subjectId/topics")
  @ApiOperation({
    summary: "Get topics for a subject",
    description: "Returns all topics under the given subject, with question counts.",
  })
  async getTopics(
    @Param("subjectId") subjectId: string,
  ): Promise<TopicResponse[]> {
    const topics = await this.topicRepo
      .createQueryBuilder("t")
      .select(["t.id", "t.name", "t.description", "t.durationMinutes", "t.subjectId", "t.isFree", "t.accessType"])
      .where("t.subjectId = :subjectId", { subjectId })
      .orderBy("t.name", "ASC")
      .getMany();

    if (topics.length === 0) return [];

    const topicIds = topics.map((t) => t.id);
    const questionCounts = await this.questionRepo
      .createQueryBuilder("q")
      .select("q.topicId", "topicId")
      .addSelect("COUNT(*)", "count")
      .where("q.topicId IN (:...ids)", { ids: topicIds })
      .groupBy("q.topicId")
      .getRawMany();

    const countMap = new Map<string, number>(
      questionCounts.map((r) => [r.topicId, Number(r.count)]),
    );

    return topics.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      durationMinutes: t.durationMinutes ?? null,
      subjectId: t.subjectId,
      isFree: t.isFree ?? false,
      accessType: t.accessType ?? (t.isFree ? "free" : "paid"),
      questionCount: countMap.get(t.id) ?? 0,
    }));
  }

  /**
   * GET /practice/topics/:topicId/questions
   * Returns practice questions for a topic in the mobile-friendly format.
   * correctIndex is the zero-based index of the correct answer in choices[].
   */
  @Get("topics/:topicId/questions")
  @ApiOperation({
    summary: "Get practice questions for a topic",
    description:
      "Returns questions with choices[] array and correctIndex (0-based). " +
      "Supports pagination and optional random ordering.",
  })
  @ApiQuery({ name: "page",   required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit",  required: false, type: Number, example: 10 })
  @ApiQuery({ name: "random", required: false, type: Boolean, example: false })
  async getTopicQuestions(
    @Param("topicId") topicId: string,
    @Query("page",   new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query("limit",  new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("random") random?: string,
  ): Promise<{ data: PracticeQuestion[]; total: number; page: number; limit: number; totalPages: number }> {
    const isRandom = random === "true" || random === "1";
    const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit));
    const take = Math.min(50, Math.max(1, limit));

    const qb = this.questionRepo
      .createQueryBuilder("q")
      .select(["q.id", "q.text", "q.options", "q.correctAnswer", "q.difficulty", "q.explanation", "q.topicId", "q.subjectId"])
      .where("q.topicId = :topicId", { topicId });

    const total = await qb.getCount();

    if (isRandom) {
      qb.orderBy("RANDOM()");
    } else {
      qb.orderBy("q.createdAt", "ASC");
    }

    qb.skip(skip).take(take);
    const questions = await qb.getMany();

    const data: PracticeQuestion[] = questions.map((q) => {
      const choices: string[] = Array.isArray(q.options) ? q.options : [];
      const correctIndex = choices.indexOf(q.correctAnswer);
      return {
        id: q.id,
        questionText: q.text,
        choices,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        difficulty: q.difficulty,
        explanation: q.explanation ?? "",
        topicId: q.topicId,
        subjectId: q.subjectId,
      };
    });

    return {
      data,
      total,
      page: Math.max(1, page),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }
}
