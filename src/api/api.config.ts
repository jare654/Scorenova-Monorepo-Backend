/**
 * Scorenova Learn – Centralized API Configuration
 * Manages environment-driven settings, external base URLs, timeout defaults, and HTTP parameters.
 */

export interface ApiConfigOptions {
  apiVersionPrefix: string;
  mistralBaseUrl: string;
  geezSmsBaseUrl: string;
  afroMessageBaseUrl: string;
  defaultTimeoutMs: number;
  aiTimeoutMs: number;
  smsTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

function getEnvString(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function getEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export const API_CONFIG: ApiConfigOptions = {
  apiVersionPrefix: getEnvString('API_VERSION_PREFIX', '/api/v1'),

  // External APIs
  mistralBaseUrl: getEnvString('MISTRAL_API_URL', 'https://api.mistral.ai/v1'),
  geezSmsBaseUrl: getEnvString('GEEZSMS_API_URL', 'https://api.geezsms.com/api/v1').replace(/\/$/, ''),
  afroMessageBaseUrl: getEnvString('AFROMESSAGE_API_URL', 'https://api.afromessage.com/api').replace(/\/$/, ''),

  // Timeout Defaults (ms)
  defaultTimeoutMs: getEnvNumber('API_DEFAULT_TIMEOUT_MS', 15_000),
  aiTimeoutMs: getEnvNumber('AI_TIMEOUT_MS', 45_000),
  smsTimeoutMs: getEnvNumber('SMS_TIMEOUT_MS', 15_000),

  // Retry Defaults
  maxRetries: getEnvNumber('API_MAX_RETRIES', 3),
  retryDelayMs: getEnvNumber('API_RETRY_DELAY_MS', 1_000),
};
