export const apiErrorCodes = {
  ORIGIN_REJECTED: 'ORIGIN_REJECTED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ApiErrorCode = (typeof apiErrorCodes)[keyof typeof apiErrorCodes];

const apiErrorStatus: Record<ApiErrorCode, number> = {
  ORIGIN_REJECTED: 403,
  RATE_LIMITED: 429,
};

const apiErrorMessages: Record<ApiErrorCode, string> = {
  ORIGIN_REJECTED: 'The request origin is not allowed.',
  RATE_LIMITED: 'Too many requests.',
};

/** Stable HTTP failure. The message never includes caller data. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor(code: ApiErrorCode) {
    super(apiErrorMessages[code]);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = apiErrorStatus[code];
  }
}
