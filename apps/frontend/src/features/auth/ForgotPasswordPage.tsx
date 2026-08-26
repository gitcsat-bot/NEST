import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../api-client/client';

type PageState = 'form' | 'sent';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pageState, setPageState] = useState<PageState>('form');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/auth/password-reset/request', {
        method: 'POST',
        body: { email },
      });
    } catch {
      // Ignored for security
    } finally {
      setSubmitting(false);
      setPageState('sent');
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-700 border-b border-gray-200/50 pb-4 w-full">Forgot Password</h1>
        </div>

        <div>
          {pageState === 'form' ? (
            <>
              <p className="text-sm text-gray-600 mb-6 text-center font-medium">
                Enter your email address and we'll send a reset link if an account exists.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                      <Mail size={18} />
                    </div>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="username"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full neu-inset rounded-xl pl-12 pr-4 py-3.5 outline-none text-gray-700 font-medium"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-4 mt-8 font-bold text-blue-600 neu-button transition-all disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send reset link'}
                  {!submitting && <ArrowRight size={18} />}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="flex justify-center mb-6">
                <CheckCircle2 size={64} className="text-emerald-500" strokeWidth={1.5} />
              </div>
              <p role="status" className="text-sm font-bold text-gray-700">
                If an account exists for that email, we've sent a reset link. Check your inbox — it may take a minute or two to arrive.
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200/50 text-center">
            <Link to="/login" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

