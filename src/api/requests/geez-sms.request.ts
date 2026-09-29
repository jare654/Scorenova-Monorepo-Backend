/**
 * Scorenova Learn – GeezSMS Request Service
 * Handles SMS and OTP sending/verification via GeezSMS external API using the centralized API client.
 */

import { API_CONFIG } from '../api.config';
import { API_ENDPOINTS } from '../api.constants';
import { createApiClient, ApiClient } from '../api.client';
import {
  GeezSmsSendOtpPayload,
  GeezSmsVerifyOtpPayload,
  GeezSmsResponse,
} from '../api.types';

export class GeezSmsRequestService {
  private client: ApiClient;

  constructor() {
    this.client = createApiClient({
      baseURL: API_CONFIG.geezSmsBaseUrl,
      timeout: API_CONFIG.smsTimeoutMs,
    });
  }

  /**
   * Dispatch OTP SMS request to GeezSMS
   */
  async sendOtp(payload: GeezSmsSendOtpPayload): Promise<GeezSmsResponse> {
    const response = await this.client.post<GeezSmsResponse>(
      API_ENDPOINTS.SMS.GEEZ_SEND_OTP,
      payload,
      {
        timeout: API_CONFIG.smsTimeoutMs,
      },
    );
    return response.data;
  }

  /**
   * Verify OTP request via GeezSMS
   */
  async verifyOtp(payload: GeezSmsVerifyOtpPayload): Promise<GeezSmsResponse> {
    const response = await this.client.post<GeezSmsResponse>(
      API_ENDPOINTS.SMS.GEEZ_VERIFY_OTP,
      payload,
      {
        timeout: 10_000,
      },
    );
    return response.data;
  }
}

export const geezSmsRequestService = new GeezSmsRequestService();
