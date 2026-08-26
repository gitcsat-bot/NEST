import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PasswordResetConfirmDto } from '@nest/shared-types';
import { apiRequest, ApiError } from '../../api-client/client';
import { AlertTriangle } from 'lucide-react';

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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md neu-flat rounded-3xl overflow-hidden p-6 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-700 border-b border-gray-200/50 pb-4 w-full text-center mb-6">Reset your password</h1>

        {!token ? (
          <p role="alert" className="text-sm text-center text-red-600 font-medium">
            This reset link is missing its token. Request a new one from the{' '}
            <a href="/forgot-password" className="font-bold underline hover:text-red-700 transition-colors">
              forgot password
            </a>{' '}
            page.
          </p>
        ) : pageState === 'done' ? (
          <p role="status" className="text-sm font-bold text-gray-700 text-center py-4">
            Your password has been updated. All other sessions have been signed out. You can now{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-800 underline transition-colors">
              sign in
            </a>{' '}
            with your new password.
          </p>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl p-4 text-sm neu-inset text-red-600 font-medium flex items-start"
              >
                <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="new-password" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
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
                  className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none text-gray-700 font-medium"
                />
                <p className="text-xs text-gray-500 mt-2 pl-1 font-medium">At least 12 characters.</p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
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
                  className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none text-gray-700 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-4 mt-8 font-bold text-blue-600 neu-button transition-all disabled:opacity-50"
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200/50 text-center text-sm">
          <a href="/login" className="font-bold text-blue-600 hover:text-blue-800 transition-colors">
            Back to login
          </a>
        </div>
      </div>
    </main>
  );
}
