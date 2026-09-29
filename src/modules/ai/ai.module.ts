import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiController } from "./controllers/ai.controller";
import { AiService } from "./ai.service";
import { LLM_PROVIDER } from "./providers/llm.provider";
import { MistralLlmProvider } from "./providers/mistral-llm.provider";
import { GenerateExplanationUsecase } from "./usecases/explain/generate-explanation.usecase";

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [
    { provide: LLM_PROVIDER, useClass: MistralLlmProvider },
    GenerateExplanationUsecase,
    AiService,
  ],
  exports: [AiService, GenerateExplanationUsecase, LLM_PROVIDER],
})
export class AiModule {}
