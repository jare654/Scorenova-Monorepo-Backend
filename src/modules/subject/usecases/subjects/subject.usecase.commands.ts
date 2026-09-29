import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SubjectEntity } from "../../models/subjects/subject.entity";
import { CreateSubjectDto, UpdateSubjectDto } from "./subject.commands";

@Injectable()
export class SubjectCommands {
  constructor(
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
  ) {}

  async createSubject(dto: CreateSubjectDto): Promise<SubjectEntity> {
    const isFree = dto.isFree ?? (dto.accessType === "free");
    const accessType = dto.accessType ?? (isFree ? "free" : "paid");
    const subject = this.subjectRepo.create({
      ...dto,
      isFree,
      accessType,
    });
    return this.subjectRepo.save(subject);
  }

  async updateSubject(id: string, dto: UpdateSubjectDto): Promise<SubjectEntity> {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    if (dto.isFree !== undefined && dto.accessType === undefined) {
      dto.accessType = dto.isFree ? "free" : "paid";
    } else if (dto.accessType !== undefined && dto.isFree === undefined) {
      dto.isFree = dto.accessType === "free";
    }

    Object.assign(subject, dto);
    return this.subjectRepo.save(subject);
  }

  async deleteSubject(id: string): Promise<boolean> {
    const result = await this.subjectRepo.delete(id);
    return result.affected > 0;
  }
}
