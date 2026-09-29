const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /authorization/i,
  /token/i,
  /password/i,
  /secret/i,
  /cookie/i,
  /session/i,
  /otp/i,
  /api[-_]?key/i,
  /phone/i,
  /email/i,
];

const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactObject(input: unknown): unknown {
  if (input == null) return input;

  if (Array.isArray(input)) {
    return input.map((item) => redactObject(item));
  }

  if (typeof input !== "object") {
    return input;
  }

  const record = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
      continue;
    }
    result[key] = redactObject(value);
  }

  return result;
}

export function sanitizeErrorMessage(message: unknown): string {
  if (typeof message !== "string") {
    return "Unknown error";
  }

  // Mask bearer tokens if they ever leak into error text.
  return message.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [REDACTED]");
}
