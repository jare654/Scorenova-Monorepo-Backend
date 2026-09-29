import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ILlmProvider, LLM_PROVIDER } from "../../providers/llm.provider";
import type { ExplainRequestDto } from "./explain.commands";
import type { ExplainResponseDto } from "./explain.response";

const RETRY_DELAYS = [3000, 6000, 12000]; // 3s, 6s, 12s backoff

@Injectable()
export class GenerateExplanationUsecase {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: ILlmProvider,
  ) {}

  async run(input: ExplainRequestDto): Promise<ExplainResponseDto> {
    const prompt = this.buildPrompt(input);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const raw = await this.llm.generate(prompt, {
          maxTokens: 1024,
          temperature: 0.3,
        });
        return this.parseStructuredOutput(raw);
      } catch (err: any) {
        const message = err?.message ?? String(err);
        const is429 = message.includes("429") || message.includes("rate limit") || message.includes("Too Many Requests");

        if (is429 && attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(`[AI] Rate limited by Mistral — retrying in ${delay}ms (attempt ${attempt + 1})`);
          await new Promise((r) => setTimeout(r, delay));
          lastError = err;
          continue;
        }

        lastError = err;
        break;
      }
    }

    throw new InternalServerErrorException(
      `Failed to get AI explanation: ${lastError?.message ?? "Unknown error"}`
    );
  }

  private buildPrompt(input: ExplainRequestDto): string {
    const subject = input.subject ? `Subject: ${input.subject}. ` : "";
    const topic = input.topic ? `Topic: ${input.topic}. ` : "";
    const questionText = input.question ?? "";
    const correctAnswer = input.correctAnswer ?? input.selectedAnswer ?? "";
    const userSelected = input.selectedAnswer ? `Student selected answer: ${input.selectedAnswer}. ` : "";
    return `You are an expert tutor. Explain the following exam question and its correct answer.

${subject}${topic}

Question: ${questionText}
Options: ${input.options?.join(", ") ?? "None"}

Correct answer: ${correctAnswer}
${userSelected}

Respond with exactly three sections, each on a new line, in this format (use these exact labels):
STEP_BY_STEP: [Your step-by-step explanation of how to reach the correct answer.]
CLEAR: [A clear, concise explanation of why this is the correct answer.]
SIMPLIFIED: [A very simplified, easy-to-understand summary in plain language.]`;
  }

  private parseStructuredOutput(raw: string): ExplainResponseDto {
    const stepByStep = this.extractSection(raw, "STEP_BY_STEP");
    const clear = this.extractSection(raw, "CLEAR");
    const simplified = this.extractSection(raw, "SIMPLIFIED");
    return {
      stepByStep: stepByStep || raw,
      clear: clear || raw,
      simplified: simplified || raw,
    };
  }

  private extractSection(text: string, label: string): string {
    const regex = new RegExp(
      `${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`,
      "i",
    );
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  }
}
