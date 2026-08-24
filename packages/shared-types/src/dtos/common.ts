// Standard envelopes — API Contract §1.4, §1.6.

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    field_errors?: FieldError[];
  };
}

// API Contract §1.6 — Common Error Codes (closed set).
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'TWO_FACTOR_REQUIRED'
  | 'TWO_FACTOR_INVALID'
  | 'ACCOUNT_LOCKED'
  | 'SESSION_EXPIRED'
  | 'STEP_UP_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'ASSET_ALREADY_ISSUED'
  | 'INSUFFICIENT_QUANTITY'
  | 'LOCATION_CYCLE'
  | 'RELATIONSHIP_CYCLE'
  | 'DUPLICATE_SERIAL_NUMBER'
  | 'FILE_TYPE_REJECTED'
  | 'FILE_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';
