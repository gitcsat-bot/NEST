import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api-client/client';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token provided.');
      return;
    }

    apiRequest('/auth/verify-email', {
      method: 'POST',
      body: { token },
    })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        if (err.fieldErrors && err.fieldErrors.length > 0) {
          setErrorMsg(err.fieldErrors.map((e: any) => e.message).join('. '));
        } else {
          setErrorMsg(err.message || 'Verification failed. The link may have expired.');
        }
      });
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md neu-flat rounded-3xl overflow-hidden p-6 md:p-8">
        <div className="text-center flex flex-col items-center mb-8">
          <div className="w-20 h-20 neu-flat rounded-full flex items-center justify-center p-3 mb-5">
            <img src="/assets/csat-logo.png" alt="CSAT Logo" className="w-full h-full object-contain hidden dark:block" />
            <img src="/assets/csat-logo-dark.png" alt="CSAT Logo Dark" className="w-full h-full object-contain dark:hidden" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-700 border-b border-gray-200/50 pb-4 w-full">Email Verification</h1>
        </div>

        <div className="text-center">
          {status === 'verifying' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-gray-600 font-medium">Verifying your email address...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <h2 className="text-2xl font-bold text-gray-700">Verified!</h2>
              <p className="text-gray-600 font-medium">Your email address has been successfully verified.</p>
              <Link 
                to="/login" 
                className="mt-6 w-full flex items-center justify-center rounded-xl py-4 font-bold text-blue-600 neu-button transition-all"
              >
                Continue to Login
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertTriangle className="w-16 h-16 text-red-500" />
              <h2 className="text-2xl font-bold text-gray-700">Verification Failed</h2>
              <p className="text-red-600 font-medium">{errorMsg}</p>
              <Link 
                to="/login" 
                className="mt-6 text-blue-600 hover:text-blue-800 font-bold transition-colors"
              >
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

