/**
 * Scorenova Learn – Centralized API Constants
 * Comprehensive endpoints registry, headers, status codes, and standard API messages.
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const API_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  X_REFRESH_TOKEN: 'x-refresh-token',
  RETRY_AFTER: 'retry-after',
  ACCEPT: 'Accept',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
} as const;

export const API_ENDPOINTS = {
  // ── Auth & Account ──
  AUTH: {
    REGISTER: '/account/auth/register',
    LOGIN: '/account/auth/login',
    LOGOUT: '/account/auth/logout',
    REFRESH_TOKEN: '/account/auth/refresh-token',
    SEND_OTP: '/account/auth/send-otp',
    VERIFY_OTP: '/account/auth/verify-otp',
    RESET_PASSWORD: '/account/auth/reset-password',
    CHANGE_PASSWORD: '/account/auth/change-password',
    ME: '/account/auth/me',
  },

  // ── Questions ──
  QUESTIONS: {
    BASE: '/questions',
    STATISTICS: '/questions/statistics',
    BULK_UPLOAD: '/questions/bulk-upload',
    BULK_DELETE: '/questions/bulk-delete',
    BY_ID: (id: string | number) => `/questions/${id}`,
    EDIT: (id: string | number) => `/questions/${id}/edit`,
    SINGLE_STATISTICS: (id: string | number) => `/questions/${id}/statistics`,
    EXPLANATIONS: (id: string | number) => `/questions/${id}/explanations`,
    GENERATE_EXPLANATION: (id: string | number) => `/questions/${id}/explanations/generate`,
    SUBMIT: (id: string | number) => `/questions/${id}/submit`,
    SAVED: '/questions/saved',
    SAVE: (id: string | number) => `/questions/${id}/save`,
    FLAGS: '/questions/flags',
    FLAG: (id: string | number) => `/questions/${id}/flag`,
    FLAG_STATUS: (flagId: string | number) => `/questions/flags/${flagId}/status`,
  },

  // ── Practice ──
  PRACTICE: {
    SUBJECTS: '/practice/subjects',
    TOPICS_BY_SUBJECT: (subjectId: string | number) => `/practice/subjects/${subjectId}/topics`,
    QUESTIONS_BY_TOPIC: (topicId: string | number) => `/practice/topics/${topicId}/questions`,
  },

  // ── Mock Exams ──
  MOCK: {
    BASE: '/mock',
    START: '/mock/start',
    SUBMIT: (mockId: string | number) => `/mock/${mockId}/submit`,
    RESULT: (mockId: string | number) => `/mock/${mockId}/result`,
  },

  // ── Attempts ──
  ATTEMPTS: {
    BASE: '/attempts',
    BY_ID: (id: string | number) => `/attempts/${id}`,
    SUMMARY: '/attempts/summary',
  },

  // ── Analytics ──
  ANALYTICS: {
    OVERVIEW: '/analytics/overview',
    PERFORMANCE: '/analytics/performance',
    STREAK: '/analytics/streak',
    WEAKNESSES: '/analytics/weaknesses',
  },

  // ── Subjects & Topics & Streams & Grades ──
  SUBJECTS: {
    BASE: '/subjects',
    BY_ID: (id: string | number) => `/subjects/${id}`,
    FIX_ALL_ASSIGNMENTS: '/subjects/fix-all-assignments',
    FIX_STREAM_ASSIGNMENTS: '/subjects/fix-stream-assignments',
    REASSIGN_QUESTIONS: '/subjects/reassign-questions',
  },
  TOPICS: {
    BASE: '/topics',
    BY_ID: (id: string | number) => `/topics/${id}`,
  },
  STREAMS: {
    BASE: '/streams',
  },
  GRADES: {
    BASE: '/grades',
  },

  // ── Feedback & Notifications ──
  FEEDBACK: {
    BASE: '/feedback',
  },
  NOTIFICATIONS: {
    MY_NOTIFICATIONS: '/notifications/get-my-notifications',
    BROADCAST: '/notifications/broadcast',
  },

  // ── Settings ──
  SETTINGS: {
    PLANS: '/settings/plans',
    BY_SECTION: (section: string) => `/settings/${section}`,
  },

  // ── AI & External Provider Endpoints ──
  AI: {
    EXPLAIN: '/ai/explain',
    MISTRAL_CHAT_COMPLETIONS: '/chat/completions',
  },

  SMS: {
    GEEZ_SEND_OTP: '/sms/otp/send',
    GEEZ_VERIFY_OTP: '/sms/otp/verify',
  },
} as const;
