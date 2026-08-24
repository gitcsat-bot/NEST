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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center text-white flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-inner mb-4">
            <img src="/assets/csat-logo.png" alt="CSAT Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Email Verification</h1>
        </div>

        <div className="p-8 text-center">
          {status === 'verifying' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-gray-600 font-medium">Verifying your email address...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <h2 className="text-2xl font-bold text-gray-900">Verified!</h2>
              <p className="text-gray-600">Your email address has been successfully verified.</p>
              <Link 
                to="/login" 
                className="mt-6 w-full flex items-center justify-center rounded-lg py-3 font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
              >
                Continue to Login
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertTriangle className="w-16 h-16 text-red-500" />
              <h2 className="text-2xl font-bold text-gray-900">Verification Failed</h2>
              <p className="text-red-600 font-medium">{errorMsg}</p>
              <Link 
                to="/login" 
                className="mt-6 text-blue-600 hover:text-blue-800 font-medium underline transition-colors"
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
