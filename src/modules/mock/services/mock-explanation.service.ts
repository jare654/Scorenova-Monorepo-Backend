import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MockExamEntity } from "../models/mock-exam.entity";
import { MockExplanationEntity } from "../models/mock-explanation.entity";
import { AiService } from "../../ai/ai.service";
import { SubjectEntity } from "../../subject/models/subjects/subject.entity";

@Injectable()
export class MockExplanationService {
  constructor(
    @InjectRepository(MockExamEntity)
    private readonly examRepo: Repository<MockExamEntity>,
    @InjectRepository(MockExplanationEntity)
    private readonly explanationRepo: Repository<MockExplanationEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    private readonly aiService: AiService,
  ) {}

  /**
   * Get cached explanation for a mock exam question.
   * Throws 404 if none generated yet.
   */
  async getExplanation(examId: string, questionIndex: number): Promise<MockExplanationEntity> {
    const cached = await this.explanationRepo.findOne({
      where: { examId, questionIndex },
    });
    if (!cached) {
      throw new NotFoundException(
        `No explanation for exam ${examId} question ${questionIndex}. Call generate first.`,
      );
    }
    return cached;
  }

  /**
   * Returns cached explanation if available, otherwise generates via AI,
   * persists, and returns. Increments usageCount on cache hit.
   */
  async getOrGenerate(examId: string, questionIndex: number): Promise<MockExplanationEntity> {
    // 1. Cache hit
    const cached = await this.explanationRepo.findOne({
      where: { examId, questionIndex },
    });
    if (cached) {
      await this.explanationRepo.increment({ examId, questionIndex }, "usageCount", 1);
      cached.usageCount += 1;
      return cached;
    }

    // 2. Load exam + question
    const exam = await this.examRepo.findOne({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Mock exam ${examId} not found`);

    const q = exam.questions[questionIndex];
    if (!q) {
      throw new NotFoundException(
        `Question index ${questionIndex} not found in exam ${examId}`,
      );
    }

    // 3. Load subject name for context
    const subject = await this.subjectRepo.findOne({
      where: { id: exam.subjectId },
      select: ["name"],
    });

    // 4. If the AI already embedded an explanation during generation, use it directly
    //    and skip an extra AI call — saves cost and latency
    if (q.explanation?.trim()) {
      const entity = this.explanationRepo.create({
        examId,
        questionIndex,
        stepByStep: q.explanation,
        clear:       q.explanation,
        simplified:  q.explanation,
        usageCount:  0,
      });
      return this.explanationRepo.save(entity);
    }

    // 5. No embedded explanation — call AI
    const aiResult = await this.aiService.explain({
      question:      q.question,
      options:       q.choices,
      correctAnswer: q.answer,
      subject:       subject?.name ?? "",
      topic:         "",
    });

    // 6. Persist and return
    const entity = this.explanationRepo.create({
      examId,
      questionIndex,
      stepByStep: aiResult.stepByStep,
      clear:       aiResult.clear,
      simplified:  aiResult.simplified,
      usageCount:  0,
    });

    return this.explanationRepo.save(entity);
  }
}

