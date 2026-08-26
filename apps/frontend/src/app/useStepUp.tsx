import { useCallback, useState, FormEvent, ReactNode } from 'react';
import { apiRequest, ApiError } from '../api-client/client';

// TDS §12.3: role approvals/rejections (and a few other admin actions)
// require a session with a fresh (<5 min) step-up verification. The
// backend enforces this with StepUpGuard and answers with
// STEP_UP_REQUIRED when it's missing/stale — this hook is the frontend
// half: wrap any such call in `withStepUp(...)`, and if the backend asks
// for a fresh check, a small password-confirm modal appears; once
// confirmed, the original call is retried automatically.
//
// Scoped to whichever page calls useStepUp() — no global context needed,
// since each admin screen that needs this owns its own modal instance.
export function useStepUp() {
  const [pending, setPending] = useState<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withStepUp = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STEP_UP_REQUIRED') {
        await new Promise<void>((resolve, reject) => setPending({ resolve, reject }));
        return action();
      }
      throw err;
    }
  }, []);

  async function confirmStepUp(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/auth/step-up', {
        method: 'POST',
        body: { password, totp_code: totp || undefined },
      });
      setPassword('');
      setTotp('');
      pending?.resolve();
      setPending(null);
    } catch {
      setError("That password didn't work.");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelStepUp() {
    pending?.reject(new ApiError('STEP_UP_REQUIRED', 'Step-up cancelled.'));
    setPending(null);
    setPassword('');
    setTotp('');
    setError(null);
  }

  const modal: ReactNode = pending ? (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={confirmStepUp}
        className="neu-flat rounded-2xl p-6 w-full max-w-sm space-y-4"
      >
        <h2 className="text-lg font-bold text-gray-700">Confirm it's you</h2>
        <p className="text-sm text-gray-500 font-medium">This action needs a fresh password check first.</p>
        <input
          type="password"
          autoFocus
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none font-medium text-gray-700"
        />
        <input
          type="text"
          placeholder="2FA code (if enabled)"
          value={totp}
          onChange={(e) => setTotp(e.target.value)}
          className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none font-medium text-gray-700"
        />
        {error && (
          <p className="text-sm font-bold text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={cancelStepUp} className="neu-button px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-all rounded-xl">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="neu-button px-4 py-2 text-sm font-bold text-blue-600 transition-all rounded-xl disabled:opacity-60"
          >
            Confirm
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return { withStepUp, modal };
}
