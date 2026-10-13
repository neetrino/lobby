export type ApiErrorField = {
  path: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields?: readonly ApiErrorField[];
  };
};

/** Stable error JSON. Field paths are included only for validation failures. */
export function apiErrorBody(input: {
  code: string;
  message: string;
  requestId: string;
  fields?: readonly ApiErrorField[];
}): ApiErrorBody {
  const error: ApiErrorBody['error'] = {
    code: input.code,
    message: input.message,
    requestId: input.requestId,
  };
  if (input.fields !== undefined) {
    error.fields = input.fields;
  }
  return { error };
}
