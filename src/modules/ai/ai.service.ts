import { Injectable } from "@nestjs/common";
import { GenerateExplanationUsecase } from "./usecases/explain/generate-explanation.usecase";
import type { ExplainRequestDto } from "./usecases/explain/explain.commands";
import type { ExplainResponseDto } from "./usecases/explain/explain.response";

@Injectable()
export class AiService {
  constructor(
    private readonly generateExplanation: GenerateExplanationUsecase,
  ) {}

  async explain(input: ExplainRequestDto): Promise<ExplainResponseDto> {
    return this.generateExplanation.run(input);
  }
}
