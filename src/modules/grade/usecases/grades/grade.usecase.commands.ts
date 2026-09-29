import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GradeEntity } from "../../models/grades/grade.entity";
import { CreateGradeDto, UpdateGradeDto } from "./grade.commands";

@Injectable()
export class GradeCommands {
  constructor(
    @InjectRepository(GradeEntity)
    private readonly gradeRepo: Repository<GradeEntity>,
  ) {}

  async createGrade(dto: CreateGradeDto): Promise<GradeEntity> {
    const grade = this.gradeRepo.create(dto);
    return this.gradeRepo.save(grade);
  }

  async updateGrade(id: string, dto: UpdateGradeDto): Promise<GradeEntity> {
    const grade = await this.gradeRepo.findOne({ where: { id } });
    if (!grade) {
      throw new NotFoundException(`Grade with ID ${id} not found`);
    }
    Object.assign(grade, dto);
    return this.gradeRepo.save(grade);
  }

  async deleteGrade(id: string): Promise<boolean> {
    const result = await this.gradeRepo.delete(id);
    return result.affected > 0;
  }
}
