import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QuestionEntity } from "../../models/questions/question.entity";
import { CreateQuestionDto, UpdateQuestionDto } from "./question.commands";

@Injectable()
export class QuestionCommands {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
  ) {}

  async createQuestion(dto: CreateQuestionDto): Promise<QuestionEntity> {
    const question = this.questionRepo.create(dto);
    return this.questionRepo.save(question);
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto): Promise<QuestionEntity> {
    const question = await this.questionRepo.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    Object.assign(question, dto);

    return this.questionRepo.save(question);
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const result = await this.questionRepo.delete(id);
    return result.affected > 0;
  }

  async bulkDeleteQuestions(ids: string[]): Promise<{ deleted: number }> {
    if (!ids.length) {
      return { deleted: 0 };
    }

    const result = await this.questionRepo.delete(ids);
    return { deleted: result.affected ?? 0 };
  }
}
