import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AccountEntity } from "@account/models/accounts/account.entity";
import { QuestionEntity } from "../../question/models/questions/question.entity";
import { AttemptEntity } from "../../attempt/models/attempts/attempt.entity";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";

@Injectable()
export class AnalyticsQueries {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
  ) { }

  // ── Overview ──────────────────────────────────────────────────────────────

  async getOverview() {
    const [
      totalUsers,
      activeUsers,
      totalQuestions,
      totalAttempts,
      totalSubjects,
      correctAttempts,
    ] = await Promise.all([
      this.accountRepo.count(),
      this.accountRepo.count({ where: { isActive: true } }),
      this.questionRepo.count(),
      this.attemptRepo.count(),
      this.subjectRepo.count(),
      this.attemptRepo.count({ where: { isCorrect: true } }),
    ]);

    const successRate = totalAttempts
      ? Number(((correctAttempts / totalAttempts) * 100).toFixed(2))
      : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      content: { questions: totalQuestions, subjects: totalSubjects },
      performance: { totalAttempts, successRate: `${successRate}%` },
      timestamp: new Date().toISOString(),
    };
  }

  // ── DAU ───────────────────────────────────────────────────────────────────

  async getDailyActiveUsers() {
    const raw = await this.attemptRepo
      .createQueryBuilder("a")
      .select("COUNT(DISTINCT a.accountId)", "count")
      .where("a.createdAt >= NOW() - INTERVAL '1 day'")
      .getRawOne();
    return { average: Number(raw?.count ?? 0), period: "24h" };
  }

  // ── MAU ───────────────────────────────────────────────────────────────────

  async getMonthlyActiveUsers() {
    const raw = await this.attemptRepo
      .createQueryBuilder("a")
      .select("COUNT(DISTINCT a.accountId)", "count")
      .where("a.createdAt >= NOW() - INTERVAL '30 days'")
      .getRawOne();
    return { average: Number(raw?.count ?? 0), period: "30d" };
  }

  // ── Peak hours ────────────────────────────────────────────────────────────

  async getPeakHours() {
    const rows = await this.attemptRepo
      .createQueryBuilder("a")
      .select("EXTRACT(HOUR FROM a.createdAt)::int", "hour")
      .addSelect("COUNT(*)", "count")
      .where("a.createdAt >= NOW() - INTERVAL '30 days'")
      .groupBy("EXTRACT(HOUR FROM a.createdAt)")
      .orderBy("hour", "ASC")
      .getRawMany();

    const hourMap = new Map<number, number>(
      rows.map((r) => [Number(r.hour), Number(r.count)]),
    );
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      count: hourMap.get(h) ?? 0,
    }));

    return { hours, period: "30d" };
  }

  // ── Registration trend ────────────────────────────────────────────────────

  async getRegistrationTrend() {
    const rows = await this.accountRepo
      .createQueryBuilder("a")
      .select("DATE(a.createdAt)", "date")
      .addSelect("COUNT(*)", "count")
      .where("a.createdAt >= NOW() - INTERVAL '30 days'")
      .groupBy("DATE(a.createdAt)")
      .orderBy("date", "ASC")
      .getRawMany();

    return {
      data: rows.map((r) => ({ date: r.date, count: Number(r.count) })),
      period: "30d",
    };
  }

  // ── Users by package ──────────────────────────────────────────────────────

  async getUsersByPackage() {
    const [premium, free] = await Promise.all([
      this.accountRepo.count({ where: { isPremium: true, isActive: true } }),
      this.accountRepo.count({ where: { isPremium: false, isActive: true } }),
    ]);
    return { premium, free, total: premium + free };
  }

  // ── Average study time per user (ms → hours) ──────────────────────────────

  async getAverageStudyTime() {
    const raw = await this.attemptRepo
      .createQueryBuilder("a")
      .select("AVG(a.timeSpentMs)", "avgMs")
      .addSelect("COUNT(DISTINCT a.accountId)", "userCount")
      .getRawOne();

    const userCount = Number(raw?.userCount ?? 0);
    if (userCount === 0) return { averageHours: 0, totalUsers: 0 };

    const avgMs = Number(raw?.avgMs ?? 0);
    return {
      averageHours: Number((avgMs / 1000 / 3600).toFixed(2)),
      totalUsers: userCount,
    };
  }

  // ── Pass/fail ratio — sessions where accuracy >= 50% = pass ──────────────

  async getPassFailRatio() {
    let mockPassed = 0;
    let mockFailed = 0;
    try {
      const mockRows: any[] = await this.attemptRepo.manager.query(
        `SELECT passed, COUNT(*)::int as count FROM mock_exam_results GROUP BY passed`,
      );
      for (const r of mockRows) {
        if (r.passed) mockPassed += Number(r.count);
        else mockFailed += Number(r.count);
      }
    } catch {
      /* ignore if table does not exist */
    }

    // Group attempts by sessionId if available, otherwise by (accountId, subjectId)
    const rows = await this.attemptRepo
      .createQueryBuilder("a")
      .select("COALESCE(a.sessionId::text, CONCAT(a.accountId::text, ':', a.subjectId::text))", "sessionKey")
      .addSelect("COUNT(*)", "total")
      .addSelect("SUM(CASE WHEN a.isCorrect = true THEN 1 ELSE 0 END)", "correct")
      .groupBy("COALESCE(a.sessionId::text, CONCAT(a.accountId::text, ':', a.subjectId::text))")
      .getRawMany();

    let passed = mockPassed;
    let failed = mockFailed;

    for (const r of rows) {
      const total = Number(r.total);
      const correct = Number(r.correct);
      const accuracy = total > 0 ? correct / total : 0;
      if (accuracy >= 0.5) passed++;
      else failed++;
    }

    const total = passed + failed;
    return {
      passed,
      failed,
      total,
      passRate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
    };
  }

  // ── Drop-off points — subjects where users stop after few attempts ─────────

  async getDropOffPoints() {
    // Find subjects where avg attempts per user is low (< 3)
    const rows = await this.attemptRepo
      .createQueryBuilder("a")
      .select("a.subjectId", "subjectId")
      .addSelect("COUNT(DISTINCT a.accountId)", "uniqueUsers")
      .addSelect("COUNT(*)", "totalAttempts")
      .groupBy("a.subjectId")
      .getRawMany();

    const subjectIds = rows.map((r) => r.subjectId).filter(Boolean);
    const subjects =
      subjectIds.length > 0
        ? await this.subjectRepo
          .createQueryBuilder("s")
          .select(["s.id", "s.name"])
          .where("s.id IN (:...ids)", { ids: subjectIds })
          .getMany()
        : [];

    const nameMap = new Map(subjects.map((s) => [s.id, s.name]));

    return rows
      .map((r) => {
        const users = Number(r.uniqueUsers);
        const attempts = Number(r.totalAttempts);
        const avgAttemptsPerUser = users > 0 ? Number((attempts / users).toFixed(1)) : 0;
        return {
          subjectId: r.subjectId,
          subjectName: nameMap.get(r.subjectId) ?? "Unknown",
          uniqueUsers: users,
          totalAttempts: attempts,
          avgAttemptsPerUser,
          // Flag as drop-off if avg < 5 attempts per user
          isDropOff: avgAttemptsPerUser < 5 && users > 0,
        };
      })
      .sort((a, b) => a.avgAttemptsPerUser - b.avgAttemptsPerUser);
  }

  // ── Content coverage — % of subjects attempted per stream ─────────────────

  async getContentCoverage() {
    const [allSubjects, attemptedSubjects, allStreams] = await Promise.all([
      this.subjectRepo.find({ select: ["id", "name", "streamId"] }),
      this.attemptRepo
        .createQueryBuilder("a")
        .select("DISTINCT a.subjectId", "subjectId")
        .getRawMany(),
      // Raw query to get streams — avoids circular module dependency
      this.subjectRepo.manager.query(
        `SELECT id, name FROM streams ORDER BY name ASC`,
      ),
    ]);

    const attemptedSet = new Set(attemptedSubjects.map((r) => r.subjectId));
    const streamNameMap = new Map<string, string>(
      (allStreams as { id: string; name: string }[]).map((s) => [s.id, s.name]),
    );

    const streamMap = new Map<string, { name: string; total: number; attempted: number }>();
    for (const s of allSubjects) {
      const key = s.streamId ?? "unassigned";
      if (!streamMap.has(key)) {
        streamMap.set(key, {
          name: streamNameMap.get(key) ?? (key === "unassigned" ? "Common Curriculum" : key),
          total: 0,
          attempted: 0,
        });
      }
      const entry = streamMap.get(key)!;
      entry.total++;
      if (attemptedSet.has(s.id)) entry.attempted++;
    }

    return Array.from(streamMap.entries()).map(([streamId, data]) => ({
      streamId,
      streamName: data.name,
      totalSubjects: data.total,
      attemptedSubjects: data.attempted,
      coveragePercent:
        data.total > 0
          ? Number(((data.attempted / data.total) * 100).toFixed(1))
          : 0,
    }));
  }

  // ── Question difficulty distribution ──────────────────────────────────────

  async getQuestionDifficultyStats() {
    const rows = await this.attemptRepo
      .createQueryBuilder("a")
      .innerJoin("questions", "q", "q.id = a.questionId")
      .select("LOWER(COALESCE(q.difficulty, 'medium'))", "difficulty")
      .addSelect("COUNT(*)", "attempts")
      .addSelect("SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)", "correct")
      .groupBy("LOWER(COALESCE(q.difficulty, 'medium'))")
      .getRawMany();

    const order = ["easy", "medium", "hard"];
    const statMap = new Map<string, { attempts: number; correct: number; accuracy: number }>();
    for (const t of order) {
      statMap.set(t, { attempts: 0, correct: 0, accuracy: 0 });
    }

    for (const r of rows) {
      const diff = String(r.difficulty || "medium").toLowerCase();
      const attempts = Number(r.attempts);
      const correct = Number(r.correct);
      const accuracy = attempts > 0 ? Number(((correct / attempts) * 100).toFixed(1)) : 0;
      statMap.set(diff, { attempts, correct, accuracy });
    }

    return Array.from(statMap.entries()).map(([difficulty, data]) => ({
      difficulty,
      attempts: data.attempts,
      correct: data.correct,
      accuracy: data.accuracy,
    }));
  }
}
