import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { mistralApiRequestService, API_CONFIG } from "@api";
import type { ILlmProvider, LlmGenerateOptions } from "./llm.provider";

// Models to try in order when capacity is exceeded.
// mistral-small-latest has better availability than open-mistral-7b on the free tier.
const MODEL_FALLBACK_CHAIN = [
  "mistral-small-latest",
  "open-mistral-7b",
  "open-mixtral-8x7b",
];

@Injectable()
export class MistralLlmProvider implements ILlmProvider {
  private readonly logger = new Logger(MistralLlmProvider.name);
  private readonly primaryModel: string;
  private readonly timeout: number;

  constructor(private readonly config: ConfigService) {
    this.primaryModel =
      this.config.get<string>("MISTRAL_MODEL") ?? "mistral-small-latest";
    // 45s is default for single Mistral call.
    this.timeout = this.config.get<number>("AI_TIMEOUT_MS") ?? API_CONFIG.aiTimeoutMs;
  }

  private get apiKey(): string {
    const key = this.config.get<string>("MISTRAL_API_KEY")?.trim();
    if (!key) {
      throw new Error(
        "MISTRAL_API_KEY is not set. Add it to .env to use the AI explain endpoint.",
      );
    }
    return key;
  }

  private isCapacityError(err: unknown): boolean {
    const status = (err as any)?.status ?? (axios.isAxiosError(err) ? err.response?.status : undefined);
    const responseData = (err as any)?.response?.data;
    const msg = responseData?.message ?? (err instanceof Error ? err.message : "");
    return (
      status === 429 ||
      status === 503 ||
      msg.toLowerCase().includes("capacity") ||
      msg.toLowerCase().includes("rate limit") ||
      msg.toLowerCase().includes("overloaded")
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Extract Retry-After seconds from a 429 response, default to fallback */
  private getRetryAfterMs(err: unknown, fallbackMs: number): number {
    const headers = (err as any)?.response?.headers;
    const retryAfter = headers?.["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(String(retryAfter), 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
    return fallbackMs;
  }

  async generate(prompt: string, options?: LlmGenerateOptions): Promise<string> {
    // Build model list: primary first, then fallbacks (deduped)
    const modelsToTry = [
      this.primaryModel,
      ...MODEL_FALLBACK_CHAIN.filter((m) => m !== this.primaryModel),
    ];

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      // Retry each model up to 3 times with exponential backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          this.logger.log(`Calling Mistral model="${model}" attempt=${attempt}`);
          const data = await mistralApiRequestService.createChatCompletion(
            {
              model,
              messages: [{ role: "user", content: prompt }],
              max_tokens: options?.maxTokens ?? 1024,
              temperature: options?.temperature ?? 0.3,
            },
            this.apiKey,
            this.timeout,
          );
          const content = data?.choices?.[0]?.message?.content;
          return typeof content === "string" ? content.trim() : "";
        } catch (err: unknown) {
          const isCapacity = this.isCapacityError(err);
          const message = (err as any)?.response?.data?.message
            ?? (err instanceof Error ? err.message : "LLM request failed");

          lastError = new Error(`Mistral generate failed: ${message}`);
          this.logger.warn(
            `Model="${model}" attempt=${attempt} failed (capacity=${isCapacity}): ${message}`,
          );

          if (!isCapacity) {
            // Non-capacity error (auth, bad request, etc.) — don't retry this model
            break;
          }

          if (attempt < 3) {
            // Short fixed delay — don't burn time on retries.
            // If the model is truly overloaded we fall through to the next model.
            const delay = this.getRetryAfterMs(err, attempt * 3_000); // 3s, 6s max
            this.logger.log(`Waiting ${delay}ms before retry...`);
            await this.sleep(delay);
          }
        }
      }
    }

    throw lastError ?? new Error("All Mistral models failed");
  }
}
