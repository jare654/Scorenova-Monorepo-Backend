import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GradeEntity } from "../../models/grades/grade.entity";

@Injectable()
export class GradeQueries {
  constructor(
    @InjectRepository(GradeEntity)
    private readonly gradeRepo: Repository<GradeEntity>,
  ) {}

  async getGrades(): Promise<{ id: string; name: string }[]> {
    return this.gradeRepo.find({
      select: ["id", "name"],
      order: { name: "ASC" },
    });
  }

  /**
   * Grade statistics: counts accounts (students) enrolled in this grade.
   * Questions are now organized by stream, not grade — so we count students
   * rather than questions to keep this endpoint meaningful.
   */
  async getGradeStatistics(
    id: string,
  ): Promise<{ gradeName: string; totalStudents: number }> {
    const grade = await this.gradeRepo.findOne({ where: { id } });
    if (!grade) {
      throw new NotFoundException(`Grade with ID ${id} not found`);
    }

    const result = await this.gradeRepo.manager.query(
      `SELECT COUNT(*)::int AS count FROM accounts WHERE grade_id = $1`,
      [id],
    );

    return {
      gradeName: grade.name,
      totalStudents: result[0]?.count ?? 0,
    };
  }

  async getAllGradesStatistics(): Promise<
    { gradeName: string; totalStudents: number }[]
  > {
    const grades = await this.gradeRepo.find({ order: { name: "ASC" } });

    const results = await this.gradeRepo.manager.query(
      `SELECT grade_id AS "gradeId", COUNT(*)::int AS count
       FROM accounts
       WHERE grade_id IS NOT NULL
       GROUP BY grade_id`,
    );

    const countsMap = new Map<string, number>();
    for (const row of results) {
      countsMap.set(row.gradeId, row.count);
    }

    return grades.map((g) => ({
      gradeName: g.name,
      totalStudents: countsMap.get(g.id) ?? 0,
    }));
  }
}
