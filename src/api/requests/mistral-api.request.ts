/**
 * Scorenova Learn – Mistral AI Request Service
 * Encapsulates Axios HTTP communications with Mistral LLM API using the centralized API Architecture.
 */

import { API_CONFIG } from '../api.config';
import { API_ENDPOINTS } from '../api.constants';
import { createApiClient, ApiClient } from '../api.client';
import { MistralChatRequest, MistralChatResponse } from '../api.types';

export class MistralApiRequestService {
  private client: ApiClient;

  constructor() {
    this.client = createApiClient({
      baseURL: API_CONFIG.mistralBaseUrl,
      timeout: API_CONFIG.aiTimeoutMs,
    });
  }

  /**
   * Execute chat completion request to Mistral API
   */
  async createChatCompletion(
    payload: MistralChatRequest,
    apiKey: string,
    timeoutMs?: number,
  ): Promise<MistralChatResponse> {
    const response = await this.client.post<MistralChatResponse>(
      API_ENDPOINTS.AI.MISTRAL_CHAT_COMPLETIONS,
      payload,
      {
        timeout: timeoutMs ?? API_CONFIG.aiTimeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    return response.data;
  }
}

export const mistralApiRequestService = new MistralApiRequestService();
