/**
 * Scorenova Learn – Reusable Axios Client Architecture
 * Features:
 * - Configurable Axios instance factory
 * - Request/Response interceptors
 * - Unified error handling & logging
 * - Bearer Token auto-injection
 * - Full TypeScript support for custom options & typed responses
 */

import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_CONFIG } from './api.config';
import { API_HEADERS, HTTP_STATUS } from './api.constants';
import { CustomClientConfig } from './api.types';

export class ApiClient {
  private instance: AxiosInstance;

  constructor(baseConfig: CustomClientConfig = {}) {
    const {
      baseURL = API_CONFIG.apiVersionPrefix,
      timeout = API_CONFIG.defaultTimeoutMs,
      headers = {},
      ...rest
    } = baseConfig;

    this.instance = axios.create({
      baseURL,
      timeout,
      headers: {
        [API_HEADERS.CONTENT_TYPE]: 'application/json',
        [API_HEADERS.ACCEPT]: 'application/json',
        ...headers,
      },
      ...rest,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // ── Request Interceptor ──
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig & CustomClientConfig) => {
        if (config.authToken && !config.skipAuth) {
          config.headers.set(API_HEADERS.AUTHORIZATION, `Bearer ${config.authToken}`);
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error),
    );

    // ── Response Interceptor ──
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => this.handleError(error),
    );
  }

  private handleError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server responded with non-2xx status code
      const status = error.response.status;
      const data = error.response.data as any;
      const message = data?.message || data?.error || error.message || 'API request failed';

      const normalizedError = new Error(`[API ${status}] ${Array.isArray(message) ? message.join(', ') : message}`);
      (normalizedError as any).status = status;
      (normalizedError as any).response = error.response;
      (normalizedError as any).isAxiosError = true;

      return Promise.reject(normalizedError);
    }

    if (error.request) {
      // Request was made but no response received (Network error or Timeout)
      const isTimeout = error.code === 'ECONNABORTED';
      const msg = isTimeout ? 'API request timed out' : 'Network error: Server unreachable';
      const networkError = new Error(msg);
      (networkError as any).status = HTTP_STATUS.SERVICE_UNAVAILABLE;
      (networkError as any).isAxiosError = true;
      return Promise.reject(networkError);
    }

    return Promise.reject(error);
  }

  public getRawInstance(): AxiosInstance {
    return this.instance;
  }

  public async get<T = any>(url: string, config?: CustomClientConfig): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }

  public async post<T = any>(url: string, data?: any, config?: CustomClientConfig): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }

  public async put<T = any>(url: string, data?: any, config?: CustomClientConfig): Promise<AxiosResponse<T>> {
    return this.instance.put<T>(url, data, config);
  }

  public async patch<T = any>(url: string, data?: any, config?: CustomClientConfig): Promise<AxiosResponse<T>> {
    return this.instance.patch<T>(url, data, config);
  }

  public async delete<T = any>(url: string, config?: CustomClientConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete<T>(url, config);
  }

  public async request<T = any>(config: CustomClientConfig): Promise<AxiosResponse<T>> {
    return this.instance.request<T>(config);
  }
}

/**
 * Default global API Client singleton instance
 */
export const apiClient = new ApiClient();

/**
 * Factory helper to create custom Axios client instances for external services (e.g. AI, SMS)
 */
export function createApiClient(config: CustomClientConfig): ApiClient {
  return new ApiClient(config);
}
