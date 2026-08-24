import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PasswordResetConfirmDto } from '@nest/shared-types';
import { apiRequest, ApiError } from '../../api-client/client';

// UI/UX Spec §5.4 — reset step, reached via the emailed link
// (`/reset-password?token=...`). API Contract: `POST
// /auth/password-reset/confirm` with `{ token, new_password }`; errors are
// deliberately generic (400 VALIDATION_ERROR covers invalid/expired/used
// token alike, per Security Acceptance Criterion #15) so this screen never
// tells the user *why* a token failed, only that it did.
type PageState = 'form' | 'done';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pageState, setPageState] = useState<PageState>('form');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const body: PasswordResetConfirmDto = { token: token ?? '', new_password: newPassword };
      await apiRequest<{ message: string }>('/auth/password-reset/confirm', {
        method: 'POST',
        body,
      });
      setPageState('done');
    } catch (err) {
      if (err instanceof ApiError) {
        setError('This reset link is invalid or has expired. Request a new one.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-md shadow-sm p-8">
        <h1 className="text-xl font-semibold mb-2 text-center">Reset your password</h1>

        {!token ? (
          <p role="alert" className="text-sm text-center" style={{ color: 'var(--nest-color-danger)' }}>
            This reset link is missing its token. Request a new one from the{' '}
            <a href="/forgot-password" className="underline">
              forgot password
            </a>{' '}
            page.
          </p>
        ) : pageState === 'done' ? (
          <p role="status" className="text-sm text-gray-700 text-center py-2">
            Your password has been updated. All other sessions have been signed out. You can now{' '}
            <a href="/login" className="underline">
              sign in
            </a>{' '}
            with your new password.
          </p>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="mb-4 rounded p-3 text-sm"
                style={{ background: '#fef2f2', color: 'var(--nest-color-danger)' }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                  style={{ borderRadius: 'var(--nest-radius)' }}
                />
                <p className="text-xs text-gray-500 mt-1">At least 12 characters.</p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                  style={{ borderRadius: 'var(--nest-radius)' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded py-2 font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--nest-color-accent)', borderRadius: 'var(--nest-radius)' }}
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        <div className="mt-4 text-center text-sm">
          <a href="/login" className="underline text-gray-500">
            Back to login
          </a>
        </div>
      </div>
    </main>
  );
}
