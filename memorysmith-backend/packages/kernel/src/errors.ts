/**
 * The single error taxonomy of the whole backend (architecture-guide.md,
 * section 15). It is defined before the first use case on purpose: without it
 * every service invents its own and the edge becomes ad-hoc translation.
 */

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'LIMIT_EXCEEDED'
  | 'INTERNAL';

export class DomainError {
  constructor(
    readonly code: ErrorCode,
    readonly message: string,
    readonly details?: unknown,
    /**
     * FORBIDDEN answers 404 so that a 403 never confirms the existence of a
     * resource the caller cannot see (RN-SUB-004). The one deliberate
     * exception is a write refused by a vault role limit: the member already
     * sees the vault in their list (RN-ACC-012), so hiding it there would
     * protect nothing and produce a vault that appears on screen and vanishes
     * on write (architecture-guide.md, section 14.2).
     */
    readonly revealsExistence: boolean = false,
  ) {}

  static validation(message: string, details?: unknown): DomainError {
    return new DomainError('VALIDATION', message, details);
  }

  static notFound(message: string, details?: unknown): DomainError {
    return new DomainError('NOT_FOUND', message, details);
  }

  /** Answers 404: the caller must not learn that the resource exists. */
  static forbidden(message: string, details?: unknown): DomainError {
    return new DomainError('FORBIDDEN', message, details);
  }

  /** Answers a real 403: the caller already knows the resource exists. */
  static forbiddenVisible(message: string, details?: unknown): DomainError {
    return new DomainError('FORBIDDEN', message, details, true);
  }

  static conflict(message: string, details?: unknown): DomainError {
    return new DomainError('CONFLICT', message, details);
  }

  static preconditionFailed(message: string, details?: unknown): DomainError {
    return new DomainError('PRECONDITION_FAILED', message, details);
  }

  static limitExceeded(message: string, details?: unknown): DomainError {
    return new DomainError('LIMIT_EXCEEDED', message, details);
  }

  static internal(message: string, details?: unknown): DomainError {
    return new DomainError('INTERNAL', message, details);
  }
}

/**
 * Optimistic locking lost the race. Raised by repositories, never by the
 * domain, and retried by the use case up to three times before surfacing
 * as CONFLICT (architecture-guide.md, section 10.2).
 */
export class ConcurrencyError extends DomainError {
  constructor(
    message = 'The resource changed while this operation was in flight',
    details?: unknown,
  ) {
    super('CONFLICT', message, details);
  }
}

/** HTTP status for each code. FORBIDDEN is the interesting row. */
export function httpStatusFor(error: DomainError): number {
  switch (error.code) {
    case 'VALIDATION':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return error.revealsExistence ? 403 : 404;
    case 'CONFLICT':
      return 409;
    case 'PRECONDITION_FAILED':
      return 412;
    case 'LIMIT_EXCEEDED':
      return 413;
    case 'INTERNAL':
      return 500;
  }
}
