import { useLocation, Link, Navigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export function DeactivatedPage() {
  const location = useLocation();
  const state = location.state as { adminEmails?: { email: string; displayName: string }[] };

  if (!state?.adminEmails) {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="text-red-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Deactivated</h1>
        <p className="text-gray-600 mb-6">
          Your account has been deactivated. You can no longer access the system. 
          If you believe this is a mistake, please contact one of the administrators below:
        </p>
        
        <ul className="text-left bg-gray-50 rounded-lg p-4 mb-6 space-y-3 border border-gray-100">
          {state.adminEmails.map((admin) => (
            <li key={admin.email} className="flex flex-col">
              <span className="font-medium text-gray-900">{admin.displayName}</span>
              <a href={"mailto:"} className="text-blue-600 hover:underline text-sm">
                {admin.email}
              </a>
            </li>
          ))}
          {state.adminEmails.length === 0 && (
            <li className="text-gray-500 text-sm">No administrators found.</li>
          )}
        </ul>

        <Link 
          to="/login"
          className="inline-flex items-center justify-center text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to login
        </Link>
      </div>
    </main>
  );
}
