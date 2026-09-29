export const LLM_PROVIDER = "LLM_PROVIDER";

export interface LlmGenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface ILlmProvider {
  generate(prompt: string, options?: LlmGenerateOptions): Promise<string>;
}
