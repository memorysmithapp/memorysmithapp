// The whole error taxonomy of the backend, turned into something a person can
// act on (architecture-guide.md section 15, and section 5.3 for this file).
//
// FORBIDDEN arrives as 404 in every case but one, so the UI says "not found":
// the interface cannot be more informative than the API, or the leak the 404
// prevents comes back through the screen.

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'LIMIT_EXCEEDED'
  | 'INTERNAL'
  | 'OFFLINE'
  | 'UNAUTHENTICATED';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the caller can fix it by trying something different. */
  get isRecoverable(): boolean {
    return this.code === 'CONFLICT' || this.code === 'VALIDATION';
  }
}

/** The i18n key each code maps to. The message itself lives in the locales. */
export function messageKeyOf(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.unexpected';
  switch (error.code) {
    case 'VALIDATION':
      return 'errors.validation';
    case 'NOT_FOUND':
    case 'FORBIDDEN':
      // Deliberately the same message: a resource we may not see and one that
      // does not exist have to be indistinguishable on screen too.
      return 'errors.notFound';
    case 'CONFLICT':
      return 'errors.conflict';
    case 'PRECONDITION_FAILED':
      return 'errors.preconditionFailed';
    case 'LIMIT_EXCEEDED':
      return 'errors.limitExceeded';
    case 'UNAUTHENTICATED':
      return 'errors.unauthenticated';
    case 'OFFLINE':
      return 'errors.offline';
    default:
      return 'errors.unexpected';
  }
}

export function apiErrorFrom(status: number, body: unknown): ApiError {
  const payload = (body ?? {}) as { code?: string; message?: string; details?: unknown };
  const code = (payload.code ?? codeFromStatus(status)) as ErrorCode;
  return new ApiError(
    code,
    payload.message ?? `Request failed with ${status}`,
    status,
    payload.details,
  );
}

function codeFromStatus(status: number): ErrorCode {
  if (status === 400) return 'VALIDATION';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 412) return 'PRECONDITION_FAILED';
  if (status === 413 || status === 429) return 'LIMIT_EXCEEDED';
  return 'INTERNAL';
}
