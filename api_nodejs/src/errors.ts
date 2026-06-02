export type ErrorDetails = Record<string, unknown> | unknown[] | null | undefined;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
};

export function buildErrorPayload(
  code: string,
  message: string,
  details?: ErrorDetails
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(details !== undefined && details !== null ? { details } : {})
    }
  };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toJSON(): ApiErrorBody {
    return buildErrorPayload(this.code, this.message, this.details);
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
