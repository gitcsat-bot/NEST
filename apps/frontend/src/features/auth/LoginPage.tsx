import { FormEvent, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginResponseDto } from '@nest/shared-types';
import { apiRequest, ApiError } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { Eye, EyeOff, Lock, Mail, ChevronRight, AlertTriangle } from 'lucide-react';

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiRequest<LoginResponseDto>('/auth/login', {
        method: 'POST',
        body: { email, password, remember_me: rememberMe },
      });

      if ('two_factor_required' in result) {
        navigate('/login/2fa', { state: { pending_token: result.pending_token, remember_me: rememberMe } });
        return;
      }

      setUser(result.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_LOCKED') {
        setError('This account is temporarily locked. Try again shortly.');
      } else if (err instanceof ApiError && err.message?.includes('deactivated')) {
        setError('Your account is suspended by the Admin. Please contact admin.csat@coeptech.ac.in');
      } else {
        setError("That email or password isn't right.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md neu-flat rounded-3xl overflow-hidden p-6 md:p-8">
        {/* Header Section */}
        <div className="text-center flex flex-col items-center mb-8">
          <div className="w-20 h-20 neu-flat rounded-full flex items-center justify-center p-3 mb-5">
            <img src="/assets/csat-logo.png" alt="CSAT Logo" className="w-full h-full object-contain hidden dark:block" />
            <img src="/assets/csat-logo-dark.png" alt="CSAT Logo Dark" className="w-full h-full object-contain dark:hidden" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-gray-700">NEST</h1>
          <p className="text-blue-600 text-sm font-bold tracking-widest uppercase">
            Networked Equipment & Stock Tracker
          </p>
        </div>

        {/* Form Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-700 mb-6 text-center border-b border-gray-200/50 pb-4">Welcome Back</h2>

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
              <label htmlFor="email" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full neu-inset rounded-xl pl-12 pr-4 py-3.5 outline-none text-gray-700 font-medium"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2 pl-1 pr-1">
                <label htmlFor="password" className="block text-sm font-bold text-gray-600">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full neu-inset rounded-xl pl-12 pr-12 py-3.5 outline-none text-gray-700 font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center pl-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-bold text-gray-600">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-blue-600 neu-button transition-all disabled:opacity-50 mt-8"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
              {!submitting && <ChevronRight size={18} />}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-gray-200/50">
            <p className="text-sm font-bold text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-800 transition-colors">
                Register now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

