import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SkipThrottle } from "@nestjs/throttler";
import { CurrentUser } from "@account/auth/decorators/current-user.decorator";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import { RolesGuard } from "@account/auth/guards/role.quards";
import { AttemptEntity } from "../models/attempts/attempt.entity";
import { ExamSessionEntity } from "../models/sessions/exam-session.entity";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";
import { AccountEntity } from "../../account/models/accounts/account.entity";
import { MockExamResultEntity } from "../../mock/models/mock-exam-result.entity";
import { TopicEntity } from "../../topic/models/topics/topic.entity";

@ApiTags("progress")
@Controller("progress")
@ApiBearerAuth("Bearer")
@SkipThrottle()   // admin-only analytics reads — exempt from rate limiting
export class ProgressController {
  constructor(
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(ExamSessionEntity)
    private readonly sessionRepo: Repository<ExamSessionEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(MockExamResultEntity)
    private readonly mockResultRepo: Repository<MockExamResultEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  // ── Shared logic — builds the full dashboard payload for any userId ────────

  private async buildDashboard(userId: string) {
    // Single query that computes totals + per-subject breakdown at once
    const [timeRaw, bySubjectRaw, streakRaw, mockResults, weeklyRaw, lastAttempt] = await Promise.all([
      this.attemptRepo
        .createQueryBuilder("a")
        .select("SUM(a.timeSpentMs)", "total")
        .where("a.accountId = :userId", { userId })
        .getRawOne(),
      this.attemptRepo
        .createQueryBuilder("a")
        .select("a.subjectId", "subjectId")
        .addSelect("COUNT(*)", "totalAttempted")
        .addSelect("SUM(CASE WHEN a.isCorrect = true THEN 1 ELSE 0 END)", "correct")
        .where("a.accountId = :userId", { userId })
        .groupBy("a.subjectId")
        .getRawMany(),
      // Streak: count consecutive days with at least one attempt ending today
      this.attemptRepo
        .createQueryBuilder("a")
        .select("DATE(a.createdAt)", "day")
        .where("a.accountId = :userId", { userId })
        .groupBy("DATE(a.createdAt)")
        .orderBy("DATE(a.createdAt)", "DESC")
        .getRawMany(),
      // Mock exam attempts taken by student
      this.mockResultRepo.find({
        where: { accountId: userId },
        order: { takenAt: "DESC" },
      }),
      // Last 7 days question counts for weekly graph
      this.attemptRepo
        .createQueryBuilder("a")
        .select("DATE(a.createdAt)", "day")
        .addSelect("COUNT(*)", "count")
        .where("a.accountId = :userId", { userId })
        .andWhere("a.createdAt >= :startDate", {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        })
        .groupBy("DATE(a.createdAt)")
        .getRawMany(),
      // Most recent attempt for continue learning
      this.attemptRepo.findOne({
        where: { accountId: userId },
        order: { createdAt: "DESC" },
      }),
    ]);

    // Derive totals from the already-computed per-subject rows (no extra COUNT)
    const totalAttempts  = bySubjectRaw.reduce((s, r) => s + Number(r.totalAttempted), 0);
    const correctAttempts = bySubjectRaw.reduce((s, r) => s + Number(r.correct), 0);

    const overallAccuracy = totalAttempts
      ? Number(((correctAttempts / totalAttempts) * 100).toFixed(1))
      : 0;

    const totalStudyTimeHours = Number(
      (Number(timeRaw?.total ?? 0) / 1000 / 3600).toFixed(2),
    );

    // Compute streak: consecutive calendar days ending today (or yesterday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let expected = new Date(today);
    for (const row of streakRaw) {
      const day = new Date(row.day);
      day.setHours(0, 0, 0, 0);
      const diffDays = Math.round((expected.getTime() - day.getTime()) / 86_400_000);
      if (diffDays === 0 || (streak === 0 && diffDays === 1)) {
        // Allow yesterday as the start (streak not broken yet today)
        streak++;
        expected = new Date(day);
        expected.setDate(expected.getDate() - 1);
      } else {
        break;
      }
    }

    const totalExamsTaken = mockResults.length;
    let averageScore = overallAccuracy;
    if (mockResults.length > 0) {
      const examScoreSum = mockResults.reduce((sum, r) => sum + (r.scorePercent || 0), 0);
      const avgExamScore = examScoreSum / mockResults.length;
      averageScore = totalAttempts > 0
        ? Number(((overallAccuracy + avgExamScore) / 2).toFixed(1))
        : Number(avgExamScore.toFixed(1));
    }

    // Weekly progress: 7 entries ending today
    const weeklyProgress = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    const weeklyMap = new Map(
      weeklyRaw.map((r) => [r.day ? new Date(r.day).toISOString().slice(0, 10) : "", Number(r.count)])
    );
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      weeklyProgress[i] = weeklyMap.get(key) ?? 0.0;
    }

    // Last learning topic & subject
    let lastLearning: any = null;
    if (lastAttempt) {
      const [lastSubject, lastTopic] = await Promise.all([
        lastAttempt.subjectId
          ? this.subjectRepo.findOne({ where: { id: lastAttempt.subjectId } })
          : null,
        lastAttempt.topicId
          ? this.topicRepo.findOne({ where: { id: lastAttempt.topicId } })
          : null,
      ]);
      lastLearning = {
        subjectId: lastAttempt.subjectId,
        subjectTitle: lastSubject?.name ?? "",
        topicId: lastAttempt.topicId,
        topicTitle: lastTopic?.name ?? "",
        lastAccessed: lastAttempt.createdAt,
      };
    }

    const subjectIds = bySubjectRaw.map((r) => r.subjectId).filter(Boolean);
    const subjects =
      subjectIds.length > 0
        ? await this.subjectRepo
            .createQueryBuilder("s")
            .select(["s.id", "s.name"])
            .where("s.id IN (:...ids)", { ids: subjectIds })
            .getMany()
        : [];

    const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

    const progressBySubject = bySubjectRaw.map((r) => {
      const total   = Number(r.totalAttempted);
      const correct = Number(r.correct);
      return {
        subjectId:      r.subjectId,
        subjectName:    subjectNameMap.get(r.subjectId) ?? "Unknown",
        totalAttempted: total,
        accuracy:       total ? Number(((correct / total) * 100).toFixed(1)) : 0,
      };
    });

    return {
      totalQuestionsAttempted: totalAttempts,
      correctAnswers:          correctAttempts,
      incorrectAnswers:        totalAttempts - correctAttempts,
      overallAccuracy,
      currentStreak:           streak,
      totalStudyTimeHours,
      progressBySubject,
      hasPracticed:            totalAttempts > 0,
      totalExamsTaken,
      averageScore,
      weeklyProgress,
      lastLearning,
    };
  }

  /**
   * GET /progress/me
   * Student-facing dashboard — uses the JWT to identify the caller.
   * Used by the mobile app Performance Analytics screen.
   */
  @Get("me")
  @ApiOperation({
    summary: "Get my own progress dashboard",
    description:
      "Returns totalQuestionsAttempted, correctAnswers, overallAccuracy, " +
      "currentStreak, totalStudyTimeHours, progressBySubject, hasPracticed. " +
      "hasPracticed=false means the student hasn't attempted any questions yet.",
  })
  async getMyDashboard(@CurrentUser() user: UserInfo) {
    return this.buildDashboard(user.id);
  }

  /**
   * GET /progress/dashboard/user/:userId
   * Full student progress for the admin UsersPage detail panel.
   */
  @Get("dashboard/user/:userId")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Get user progress dashboard (Admin Only)" })
  async getUserDashboard(@Param("userId") userId: string) {
    return this.buildDashboard(userId);
  }

  /**
   * GET /progress/subject/:subjectId
   * Single-subject accuracy — kept for backward compat.
   */
  @Get("subject/:subjectId")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "Get subject-level accuracy (Admin Only)" })
  async getSubjectProgress(@Param("subjectId") subjectId: string) {
    const raw = await this.attemptRepo
      .createQueryBuilder("a")
      .select("COUNT(*)", "total")
      .addSelect("SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)", "correct")
      .where("a.subjectId = :subjectId", { subjectId })
      .getRawOne();

    const total = Number(raw?.total ?? 0);
    const correct = Number(raw?.correct ?? 0);
    const accuracy = total ? Number(((correct / total) * 100).toFixed(1)) : 0;

    return { subjectId, totalAttempts: total, correctAttempts: correct, accuracy };
  }

  /**
   * GET /progress/subjects/all
   * Returns accuracy for ALL subjects in a single query.
   * Used by the AnalyticsPage radar chart — replaces N parallel calls.
   */
  @Get("subjects/all")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({
    summary: "Get accuracy for all subjects in one query (Admin Only)",
    description:
      "Returns a map of subjectId → accuracy. Use this instead of calling " +
      "/progress/subject/:id per subject to avoid rate limiting.",
  })
  async getAllSubjectsProgress() {
    const rows = await this.attemptRepo
      .createQueryBuilder("a")
      .select("a.subjectId", "subjectId")
      .addSelect("COUNT(*)", "total")
      .addSelect("SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)", "correct")
      .groupBy("a.subjectId")
      .getRawMany();

    return rows.map((r) => {
      const total = Number(r.total);
      const correct = Number(r.correct);
      return {
        subjectId: r.subjectId,
        totalAttempts: total,
        correctAttempts: correct,
        accuracy: total ? Number(((correct / total) * 100).toFixed(1)) : 0,
      };
    });
  }

  /**
   * GET /progress/exam-sessions
   * Admin: list all exam sessions with student name, subject, score, date.
   * Supports pagination via ?page=1&limit=20
   */
  @Get("exam-sessions")
  @UseGuards(RolesGuard("admin"))
  @ApiOperation({ summary: "List all exam sessions with scores (Admin Only)" })
  @ApiQuery({ name: "page",      required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit",     required: false, type: Number, example: 20 })
  @ApiQuery({ name: "subjectId", required: false, type: String })
  async getExamSessions(
    @Query("page")      pageStr?: string,
    @Query("limit")     limitStr?: string,
    @Query("subjectId") subjectId?: string,
  ) {
    const page  = Math.max(1, parseInt(pageStr  ?? "1",  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? "20", 10) || 20));
    const skip  = (page - 1) * limit;

    // Build session query
    const sessionQb = this.sessionRepo
      .createQueryBuilder("s")
      .select(["s.id", "s.accountId", "s.subjectId", "s.createdAt"])
      .orderBy("s.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    if (subjectId?.trim()) {
      sessionQb.where("s.subjectId = :subjectId", { subjectId });
    }

    const [sessions, total] = await sessionQb.getManyAndCount();

    if (sessions.length === 0) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const sessionIds  = sessions.map((s) => s.id);
    const accountIds  = [...new Set(sessions.map((s) => s.accountId))];
    const subjectIds  = [...new Set(sessions.map((s) => s.subjectId))];

    // Batch-load scores, accounts, subjects
    const [scoreRows, accounts, subjects] = await Promise.all([
      this.attemptRepo
        .createQueryBuilder("a")
        .select("a.sessionId", "sessionId")
        .addSelect("COUNT(*)", "total")
        .addSelect("SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)", "correct")
        .where("a.sessionId IN (:...ids)", { ids: sessionIds })
        .groupBy("a.sessionId")
        .getRawMany(),
      this.accountRepo
        .createQueryBuilder("a")
        .select(["a.id", "a.name", "a.phoneNumber"])
        .where("a.id IN (:...ids)", { ids: accountIds })
        .getMany(),
      this.subjectRepo
        .createQueryBuilder("s")
        .select(["s.id", "s.name"])
        .where("s.id IN (:...ids)", { ids: subjectIds })
        .getMany(),
    ]);

    const scoreMap   = new Map(scoreRows.map((r) => [r.sessionId, r]));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const data = sessions.map((session) => {
      const score   = scoreMap.get(session.id);
      const total   = Number(score?.total   ?? 0);
      const correct = Number(score?.correct ?? 0);
      const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
      const account = accountMap.get(session.accountId);
      const subject = subjectMap.get(session.subjectId);

      return {
        sessionId:    session.id,
        studentName:  account?.name        ?? "Unknown",
        studentPhone: account?.phoneNumber ?? "—",
        subjectId:    session.subjectId,
        subjectName:  subject?.name        ?? "Unknown",
        totalQ:       total,
        correct,
        scorePercent: pct,
        passed:       pct >= 50,
        takenAt:      session.createdAt,
      };
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
