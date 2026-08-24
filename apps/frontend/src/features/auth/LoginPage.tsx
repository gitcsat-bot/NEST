import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginResponseDto } from '@nest/shared-types';
import { apiRequest, ApiError } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { Eye, EyeOff, Lock, Mail, ChevronRight, AlertTriangle } from 'lucide-react';

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiRequest<LoginResponseDto>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      if ('two_factor_required' in result) {
        navigate('/login/2fa', { state: { pending_token: result.pending_token } });
        return;
      }

      setUser(result.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_LOCKED') {
        setError('This account is temporarily locked. Try again shortly.');
      } else if (err instanceof ApiError && err.details?.status === 'deactivated') {
        navigate('/deactivated', { state: { adminEmails: err.details.adminEmails } });
      } else {
        setError("That email or password isn't right.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header Section */}
        <div className="bg-blue-600 p-8 text-center text-white flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-inner mb-4">
            <img src="/assets/csat-logo.png" alt="CSAT Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">NEST</h1>
          <p className="text-blue-100 text-sm font-medium tracking-widest uppercase">
            Networked Equipment & Stock Tracker
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Welcome Back</h2>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg p-4 text-sm bg-red-50 text-red-600 border border-red-100 flex items-start"
            >
              <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-3 mt-2 font-bold text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
              {!submitting && <ChevronRight size={18} />}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                Register now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
