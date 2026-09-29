/**
 * Scorenova Learn – Centralized API Types
 * Interfaces and contracts for API requests, standard responses, error shapes, and HTTP client configurations.
 */

import type { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface StandardApiResponse<T = any> {
  statusCode: number;
  success: boolean;
  message?: string;
  data: T;
  meta?: Record<string, any>;
  timestamp?: string;
}

export interface PaginatedMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedApiResponse<T = any> extends StandardApiResponse<T[]> {
  meta: PaginatedMeta;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
}

export interface CustomClientConfig extends AxiosRequestConfig {
  authToken?: string;
  skipAuth?: boolean;
  retryCount?: number;
}

export type ApiRequestOptions = CustomClientConfig;

export type ApiResponsePromise<T = any> = Promise<AxiosResponse<StandardApiResponse<T>>>;

// External API specific payload types
export interface MistralChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MistralChatRequest {
  model: string;
  messages: MistralChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface MistralChatChoice {
  index?: number;
  message?: MistralChatMessage;
  finish_reason?: string;
}

export interface MistralChatResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: MistralChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface GeezSmsSendOtpPayload {
  token: string;
  phone: string;
  msg: string;
}

export interface GeezSmsVerifyOtpPayload {
  token: string;
  phone: string;
  code: string;
}

export interface GeezSmsResponse<T = any> {
  success?: boolean;
  status?: string;
  message?: string;
  error?: string;
  id?: string;
  data?: T;
}
