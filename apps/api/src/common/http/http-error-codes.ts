/** Codes produced by the global HTTP mapper. Module codes stay in the owning module. */
export const httpErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  REQUEST_REJECTED: 'REQUEST_REJECTED',
} as const;

export type HttpErrorCode = (typeof httpErrorCodes)[keyof typeof httpErrorCodes];

export const httpErrorMessages = {
  VALIDATION_ERROR: 'Validation failed.',
  INTERNAL_ERROR: 'Something went wrong.',
  NOT_FOUND: 'The requested resource was not found.',
  REQUEST_REJECTED: 'The request could not be processed.',
} as const satisfies Record<HttpErrorCode, string>;
