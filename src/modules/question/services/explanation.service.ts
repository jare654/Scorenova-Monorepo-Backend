import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QuestionEntity } from "../models/questions/question.entity";
import { QuestionExplanationEntity } from "../models/question-explanation.entity";
import { AiService } from "../../ai/ai.service";

@Injectable()
export class ExplanationService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(QuestionExplanationEntity)
    private readonly explanationRepo: Repository<QuestionExplanationEntity>,
    private readonly aiService: AiService,
  ) {}

  /**
   * Returns cached explanation if it exists.
   * Throws 404 if no explanation has been generated yet.
   */
  async getExplanation(questionId: string): Promise<QuestionExplanationEntity> {
    const explanation = await this.explanationRepo.findOne({
      where: { questionId },
    });
    if (!explanation) {
      throw new NotFoundException(
        `No explanation found for question ${questionId}. Call POST /questions/${questionId}/explanations/generate first.`,
      );
    }
    return explanation;
  }

  /**
   * Returns cached explanation if available, otherwise calls AI,
   * persists the result, and returns it. Increments usageCount on cache hit.
   */
  async getOrGenerate(questionId: string): Promise<QuestionExplanationEntity> {
    // 1. Cache hit
    const cached = await this.explanationRepo.findOne({ where: { questionId } });
    if (cached) {
      await this.explanationRepo.increment({ questionId }, "usageCount", 1);
      cached.usageCount += 1;
      return cached;
    }

    // 2. Load question with subject and topic for context
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
      relations: ["subject", "topic"],
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    // 3. Normalize question text before sending to AI
    const normalizedText = this.normalizeText(question.text);

    // 4. Call AI service
    const aiResult = await this.aiService.explain({
      question: normalizedText,
      options: question.options ?? [],
      correctAnswer: question.correctAnswer,
      subject: question.subject?.name ?? "",
      topic: question.topic?.name ?? "",
    });

    // 5. Persist and return
    const explanation = this.explanationRepo.create({
      questionId,
      stepByStep: aiResult.stepByStep,
      clear: aiResult.clear,
      simplified: aiResult.simplified,
      usageCount: 0,
    });

    return this.explanationRepo.save(explanation);
  }

  private normalizeText(text: string): string {
    return text.trim().replace(/\s+/g, " ");
  }
}
