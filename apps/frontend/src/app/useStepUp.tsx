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
        className="bg-white rounded p-6 w-full max-w-sm space-y-3"
        style={{ borderRadius: 'var(--nest-radius)' }}
      >
        <h2 className="text-lg font-semibold">Confirm it's you</h2>
        <p className="text-sm text-gray-600">This action needs a fresh password check first.</p>
        <input
          type="password"
          autoFocus
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
          style={{ borderRadius: 'var(--nest-radius)' }}
        />
        <input
          type="text"
          placeholder="2FA code (if enabled)"
          value={totp}
          onChange={(e) => setTotp(e.target.value)}
          className="w-full rounded border px-3 py-2"
          style={{ borderRadius: 'var(--nest-radius)' }}
        />
        {error && (
          <p className="text-sm" style={{ color: 'var(--nest-color-danger)' }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={cancelStepUp} className="px-3 py-1.5 text-sm rounded border">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded text-white disabled:opacity-60"
            style={{ background: 'var(--nest-color-accent)' }}
          >
            {submitting ? 'Checking…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return { withStepUp, modal };
}
