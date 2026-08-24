import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode, FieldError } from '@nest/shared-types';

// The one exception type every domain operation throws for an expected,
// named failure (API Contract §1.5/§1.6). Using a single class with a
// closed `code` union keeps every error response shaped identically,
// which is what lets the frontend switch on `error.code` instead of
// string-matching a message (UI/UX Spec §7/§8).
export class ApiException extends HttpException {
  constructor(
    code: ApiErrorCode,
    message: string,
    status: HttpStatus,
    fieldErrors?: FieldError[],
  ) {
    super({ error: { code, message, ...(fieldErrors ? { field_errors: fieldErrors } : {}) } }, status);
  }
}

// Convenience constructors for the errors named explicitly across the
// TDS/API Contract/Security Design, so call sites read as intent
// ("throw ApiExceptions.assetAlreadyIssued()") rather than repeating the
// status/code pairing at every call site.
export const ApiExceptions = {
  invalidCredentials: () =>
    new ApiException('INVALID_CREDENTIALS', "That email or password isn't right.", HttpStatus.UNAUTHORIZED),
  accountLocked: () =>
    new ApiException(
      'ACCOUNT_LOCKED',
      'This account is temporarily locked due to repeated failed sign-in attempts. Try again shortly.',
      HttpStatus.FORBIDDEN,
    ),
  twoFactorInvalid: () =>
    new ApiException('TWO_FACTOR_INVALID', "That code didn't work — check the time on your device and try again.", HttpStatus.UNAUTHORIZED),
  sessionExpired: () =>
    new ApiException('SESSION_EXPIRED', 'Your session has expired. Please sign in again.', HttpStatus.UNAUTHORIZED),
  stepUpRequired: () =>
    new ApiException(
      'STEP_UP_REQUIRED',
      'This action requires you to re-verify your identity first.',
      HttpStatus.FORBIDDEN,
    ),
  forbidden: () =>
    new ApiException('FORBIDDEN', "You don't have permission to do this.", HttpStatus.FORBIDDEN),
  notFound: (what = 'Resource') =>
    new ApiException('NOT_FOUND', `${what} not found.`, HttpStatus.NOT_FOUND),
  validation: (fieldErrors: FieldError[]) =>
    new ApiException('VALIDATION_ERROR', 'Please fix the highlighted fields.', HttpStatus.BAD_REQUEST, fieldErrors),
  conflict: (code: ApiErrorCode, message: string) =>
    new ApiException(code, message, HttpStatus.CONFLICT),
  invalidStateTransition: (from: string, to: string) =>
    new ApiException(
      'INVALID_STATE_TRANSITION',
      `Cannot change status from "${from}" to "${to}".`,
      HttpStatus.CONFLICT,
    ),
  insufficientQuantity: () =>
    new ApiException(
      'INSUFFICIENT_QUANTITY',
      'There is not enough quantity on hand for this operation.',
      HttpStatus.CONFLICT,
    ),
};
