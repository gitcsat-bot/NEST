import { ApiErrorBody } from '@nest/shared-types';

// A single fetch wrapper every feature module goes through, so the
// "credentials: include" (session cookie), CSRF header (API Contract
// §1.3), and error-envelope parsing (API Contract §1.4) rules are applied
// exactly once rather than re-implemented per call site.
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: { field: string; message: string }[],
    public readonly details?: any,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
export function setCsrfToken(token: string) {
  csrfToken = token;
}

// Fetch the CSRF token from the server once on app load (API Contract §1.3).
// Silently no-ops if the endpoint isn't live yet — the X-CSRF-Token header
// simply won't be sent until this succeeds, which is safe during development
// before the backend CSRF issuance endpoint is wired.
export async function bootstrapCsrf(): Promise<void> {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const res = await fetch(`${baseUrl}/auth/csrf`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data?.csrf_token === 'string') {
      setCsrfToken(data.csrf_token);
    }
  } catch {
    // Network error or endpoint not yet implemented — safe to ignore.
  }
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const isStateChanging = method !== 'GET';
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include', // sends the HttpOnly session cookie
    headers: {
      'Content-Type': 'application/json',
      ...(isStateChanging && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json();

  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    throw new ApiError(
      errorBody.error?.code ?? 'INTERNAL_ERROR',
      errorBody.error?.message ?? 'Something went wrong.',
      errorBody.error?.field_errors,
      body,
    );
  }

  return body as T;
}
