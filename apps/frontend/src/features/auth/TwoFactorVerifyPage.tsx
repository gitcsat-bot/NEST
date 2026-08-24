import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { TwoFactorVerifyRequestDto, LoginSuccessResponseDto } from '@nest/shared-types';
import { apiRequest, ApiError } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { AlertTriangle, KeyRound, ShieldCheck, RefreshCw, ChevronRight } from 'lucide-react';

export function TwoFactorVerifyPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingToken: string | undefined = (location.state as { pending_token?: string })?.pending_token;

  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  async function submitCode(codeValue: string) {
    if (!pendingToken || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: TwoFactorVerifyRequestDto = { pending_token: pendingToken, code: codeValue };
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

  function handleResend() {
    setError(null);
    setCode('');
    codeInputRef.current?.focus();
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  if (!pendingToken) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header Section */}
        <div className="bg-blue-600 p-8 text-center text-white flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-inner mb-4">
            <img src="/assets/csat-logo.png" alt="CSAT Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Two-Factor Authentication</h1>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <div className="flex justify-center mb-4 text-blue-600">
            {useRecovery ? <KeyRound size={48} strokeWidth={1.5} /> : <ShieldCheck size={48} strokeWidth={1.5} />}
          </div>
          <p className="text-sm text-gray-600 mb-6 text-center">
            {useRecovery
              ? 'Enter one of your unused recovery codes.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg p-4 text-sm bg-red-50 text-red-600 border border-red-100 flex items-start"
            >
              <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {useRecovery ? (
              <div>
                <label htmlFor="recovery-code" className="block text-sm font-semibold text-gray-700 mb-1.5 text-center">
                  Recovery Code
                </label>
                <input
                  id="recovery-code"
                  ref={codeInputRef}
                  type="text"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="xxxx-xxxx-xxxx"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 font-mono text-center tracking-[0.2em] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Recovery codes are single-use. Each code can only be used once.
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="totp-code" className="block text-sm font-semibold text-gray-700 mb-1.5 text-center">
                  Authentication Code
                </label>
                <input
                  id="totp-code"
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 font-mono text-center tracking-[0.3em] text-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">Auto-submits when all 6 digits are entered.</p>
              </div>
            )}

            {useRecovery && (
              <button
                type="submit"
                disabled={submitting || !code}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-bold text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg mt-4"
              >
                {submitting ? 'Verifying...' : 'Verify recovery code'}
                {!submitting && <ChevronRight size={18} />}
              </button>
            )}
          </form>

          {!useRecovery && (
            <div className="mt-6 text-center">
              <button
                type="button"
                disabled={resendCooldown > 0}
                onClick={handleResend}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={14} className={resendCooldown > 0 ? "animate-spin" : ""} />
                {resendCooldown > 0
                  ? `Check authenticator app (${resendCooldown}s)`
                  : "Didn't receive a code? Get a new one"}
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col space-y-3">
            {useRecovery ? (
              <button
                type="button"
                onClick={handleSwitchToTotp}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Use authenticator app instead
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSwitchToRecovery}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Use a recovery code instead
              </button>
            )}
            
            <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors text-center">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
