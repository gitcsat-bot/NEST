import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { TwoFactorVerifyRequestDto, LoginSuccessResponseDto } from '@nest/shared-types';
import { apiRequest, ApiError } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react';

export function TwoFactorVerifyPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingToken: string | undefined = (location.state as { pending_token?: string })?.pending_token;
  const rememberMe: boolean | undefined = (location.state as { remember_me?: boolean })?.remember_me;

  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingToken) {
      navigate('/login', { replace: true });
    }
  }, [pendingToken, navigate]);

  useEffect(() => {
    if (!useRecovery && code.length === 6) {
      submitCode(code);
    }
    // No exhaustive deps needed since navigate is stable
  }, [code, useRecovery]);



  async function submitCode(codeValue: string) {
    if (!pendingToken || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: TwoFactorVerifyRequestDto = { pending_token: pendingToken, code: codeValue, remember_me: rememberMe };
      const result = await apiRequest<LoginSuccessResponseDto>('/auth/2fa/verify', {
        method: 'POST',
        body,
      });
      setUser(result.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TWO_FACTOR_INVALID') {
          setError(
            useRecovery
              ? 'This recovery code has already been used or is invalid.'
              : "That code didn't work — check the time on your device and try again.",
          );
        } else if (err.code === 'SESSION_EXPIRED') {
          setError('This login session has expired. Please sign in again.');
          navigate('/login', { replace: true });
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    submitCode(code);
  }

  function handleSwitchToRecovery() {
    setUseRecovery(true);
    setCode('');
    setError(null);
  }

  function handleSwitchToTotp() {
    setUseRecovery(false);
    setCode('');
    setError(null);
  }



  if (!pendingToken) return null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm neu-flat rounded-3xl overflow-hidden p-6 md:p-8">
        
        <div className="text-center flex flex-col items-center mb-6">
          <div className="w-16 h-16 neu-inset rounded-2xl flex items-center justify-center mb-4 p-3">
            <img src="/assets/csat-logo.png" alt="CSAT Logo" className="w-full h-full object-contain filter drop-shadow-sm hidden dark:block" />
            <img src="/assets/csat-logo-dark.png" alt="CSAT Logo Dark" className="w-full h-full object-contain filter drop-shadow-sm dark:hidden" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-700 border-b border-gray-200/50 pb-4 w-full">2FA Authentication</h1>
        </div>

        <div className="flex justify-center mb-6 text-blue-600">
          {useRecovery ? <KeyRound size={48} strokeWidth={1.5} /> : <ShieldCheck size={48} strokeWidth={1.5} />}
        </div>
        <p className="text-sm font-medium text-gray-500 mb-6 text-center">
          {useRecovery
            ? 'Enter one of your unused recovery codes.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>

        {error && (
          <div role="alert" className="mb-6 rounded-xl p-4 text-sm neu-inset text-red-600 font-medium flex items-start">
            <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-6">
          {useRecovery ? (
            <div>
              <label htmlFor="recovery-code" className="block text-sm font-bold text-gray-600 mb-2 text-center">
                Recovery Code
              </label>
              <input
                id="recovery-code"
                ref={codeInputRef}
                type="text"
                required
                autoFocus
                autoComplete="off"
                spellCheck="false"
                value={code}
                onChange={(e) => setCode(e.target.value.trim().toLowerCase())}
                placeholder="xxxx-xxxx"
                className="w-full neu-inset rounded-xl px-4 py-3.5 font-mono text-center tracking-widest text-lg font-bold text-gray-700 outline-none"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="auth-code" className="block text-sm font-bold text-gray-600 mb-2 text-center">
                Authentication Code
              </label>
              <input
                id="auth-code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full neu-inset rounded-xl px-4 py-3.5 font-mono text-center tracking-[0.5em] text-2xl font-bold text-gray-700 outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || code.length === 0}
            className="w-full neu-button py-3 font-bold text-blue-600 disabled:opacity-60 rounded-xl transition-all"
          >
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center justify-between border-t border-gray-200/50 pt-6 gap-4">
          {!useRecovery ? (
            <button
              type="button"
              onClick={handleSwitchToRecovery}
              className="text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
            >
              Use a recovery code instead
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSwitchToTotp}
              className="text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
            >
              Use authenticator app
            </button>
          )}

          <Link
            to="/login"
            replace
            className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel and return to login
          </Link>
        </div>
      </div>
    </main>
  );
}

