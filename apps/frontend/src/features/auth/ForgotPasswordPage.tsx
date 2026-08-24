import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

type PageState = 'form' | 'sent';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pageState, setPageState] = useState<PageState>('form');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/v1/auth/password-reset/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Ignored for security
    } finally {
      setSubmitting(false);
      setPageState('sent');
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
          <h1 className="text-xl font-bold tracking-tight">Forgot Password</h1>
        </div>

        <div className="p-8">
          {pageState === 'form' ? (
            <>
              <p className="text-sm text-gray-600 mb-6 text-center">
                Enter your email address and we'll send a reset link if an account exists.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
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
                      className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-bold text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg mt-2"
                >
                  {submitting ? 'Sending...' : 'Send reset link'}
                  {!submitting && <ArrowRight size={18} />}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <CheckCircle2 size={48} className="text-green-500" strokeWidth={1.5} />
              </div>
              <p role="status" className="text-sm font-medium text-gray-700">
                If an account exists for that email, we've sent a reset link. Check your inbox — it may take a minute or two to arrive.
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
