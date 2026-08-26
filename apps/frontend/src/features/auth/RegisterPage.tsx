import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Gender, MIS_BRANCHES } from '@nest/shared-types';
import { apiRequest, ApiError } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { UserPlus, User, Mail, Lock, CheckCircle2, AlertTriangle, Fingerprint } from 'lucide-react';
import teamOptions from './team-options.json';

function parseMisId(misId: string | undefined | null) {
  if (!misId || !/^\d{9}$/.test(misId)) return null;

  const degreeCode = misId.substring(0, 2);
  if (degreeCode !== '61' && degreeCode !== '71') return null;
  const yearCode = misId.substring(2, 4);
  const branchCode = misId.substring(4, 6);
  if (!MIS_BRANCHES[branchCode as keyof typeof MIS_BRANCHES]) return null;
  
  const degree = degreeCode === '61' ? 'B.Tech' : 'M.Tech';
  const year = `20${yearCode}`;
  const branch = MIS_BRANCHES[branchCode as keyof typeof MIS_BRANCHES];
  
  return `${degree} in ${branch}, Class of ${parseInt(year) + (degreeCode === '71' ? 2 : 4)}`;
}

export function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [misId, setMisId] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.PREFER_NOT_TO_SAY);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [subsystem, setSubsystem] = useState('');
  const [teamRole, setTeamRole] = useState('');
  const [requestedRole, setRequestedRole] = useState<'viewer' | 'student' | 'admin'>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!parseMisId(misId)) {
      setError('Please enter correct MIS ID');
      return;
    }

    setSubmitting(true);
    try {
      if (!otpSent) {
        await apiRequest('/auth/register/send-otp', {
          method: 'POST',
          body: { email }
        });
        setOtpSent(true);
      } else {
        const result = await apiRequest<{ user: any }>('/auth/register', {
          method: 'POST',
          body: {
            email,
            password,
            otp,
            display_name: displayName,
            mis_id: misId,
            gender,
            whatsapp_number: whatsappNumber,
            subsystem,
            team_role: teamRole,
            requested_role: requestedRole,
          },
        });
        setUser(result.user);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors && err.fieldErrors.length > 0) {
          setError(err.fieldErrors.map((e) => e.message).join('. '));
        } else {
          setError(err.message);
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (otpSent) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md neu-flat rounded-3xl overflow-hidden my-8 p-6 md:p-8">
          <div className="text-center flex flex-col items-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-700 border-b border-gray-200/50 pb-4 w-full">Verify Email</h1>
          </div>
          <div>
            <p className="text-gray-600 mb-6 text-center text-sm font-medium">
              We've sent a 6-digit code to <strong className="text-gray-800">{email}</strong>. Enter it below to complete registration.
            </p>
            {error && (
              <div className="mb-6 rounded-xl p-4 text-sm neu-inset text-red-600 font-medium flex items-start">
                <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 pl-1">Verification Code</label>
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none font-mono tracking-widest text-center text-xl text-gray-700"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-4 font-bold text-blue-600 neu-button transition-all disabled:opacity-50 mt-8"
              >
                {submitting ? 'Verifying...' : 'Complete Registration'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                &larr; Change email or details
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md neu-flat rounded-3xl overflow-hidden my-8 p-6 md:p-8">
        {/* Header Section */}
        <div className="text-center flex flex-col items-center mb-8">
          <div className="w-20 h-20 neu-flat rounded-full flex items-center justify-center p-3 mb-5">
            <img src="/assets/csat-logo.png" alt="CSAT Logo" className="w-full h-full object-contain hidden dark:block" />
            <img src="/assets/csat-logo-dark.png" alt="CSAT Logo Dark" className="w-full h-full object-contain dark:hidden" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-700 border-b border-gray-200/50 pb-4 w-full">Create Account</h1>
        </div>

        <div>
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
              <label htmlFor="reg-name" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Display Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input
                  id="reg-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full neu-inset rounded-xl pl-12 pr-4 py-3.5 outline-none text-gray-700 font-medium"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input
                  id="reg-email"
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
              <label htmlFor="reg-mis-id" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                MIS ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Fingerprint size={18} />
                </div>
                <input
                  id="reg-mis-id"
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="\d{9}"
                  maxLength={9}
                  placeholder="123456789"
                  value={misId}
                  onChange={(e) => setMisId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="w-full neu-inset rounded-xl pl-12 pr-4 py-3.5 font-mono tracking-widest outline-none text-gray-700"
                />
              </div>
              <div className="mt-2 pl-1">
                {parseMisId(misId) ? (
                  <p className="text-xs text-emerald-600 font-bold">{parseMisId(misId)}</p>
                ) : (
                  <p className="text-xs text-gray-500 font-medium">Exactly 9 digits, as printed on your college ID.</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="reg-gender" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Gender
              </label>
              <select
                id="reg-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none text-gray-700 font-medium bg-transparent appearance-none"
              >
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.FEMALE}>Female</option>
                <option value={Gender.OTHER}>Other</option>
                <option value={Gender.PREFER_NOT_TO_SAY}>Prefer not to say</option>
              </select>
            </div>

            <div>
              <label htmlFor="reg-whatsapp" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                WhatsApp Number
              </label>
              <input
                id="reg-whatsapp"
                type="text"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none text-gray-700 font-medium"
                placeholder="+1234567890"
              />
              <p className="text-xs text-gray-500 mt-2 pl-1 font-medium">Include country code (e.g. +91)</p>
            </div>

            <div>
              <label htmlFor="reg-subsystem" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Subsystem
              </label>
              <select
                id="reg-subsystem"
                required
                value={subsystem}
                onChange={(e) => setSubsystem(e.target.value)}
                className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none text-gray-700 font-medium bg-transparent appearance-none"
              >
                <option value="" disabled>Select Subsystem</option>
                {teamOptions.subsystems.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reg-team-role" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Team Role
              </label>
              <select
                id="reg-team-role"
                required
                value={teamRole}
                onChange={(e) => setTeamRole(e.target.value)}
                className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none text-gray-700 font-medium bg-transparent appearance-none"
              >
                <option value="" disabled>Select Team Role</option>
                {teamOptions.teamRoles.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  id="reg-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full neu-inset rounded-xl pl-12 pr-4 py-3.5 outline-none text-gray-700 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <CheckCircle2 size={18} />
                </div>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full neu-inset rounded-xl pl-12 pr-4 py-3.5 outline-none text-gray-700 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-role" className="block text-sm font-bold text-gray-600 mb-2 pl-1">
                Register as
              </label>
              <select
                id="reg-role"
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as any)}
                className="w-full neu-inset rounded-xl px-4 py-3.5 outline-none text-gray-700 font-medium bg-transparent appearance-none"
              >
                <option value="viewer">Viewer (immediate access)</option>
                <option value="student">Student (requires admin approval)</option>
                <option value="admin">Admin (requires admin approval)</option>
              </select>
              {requestedRole !== 'viewer' && (
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-3 rounded-xl border border-amber-100 font-medium">
                  You will be assigned the Viewer role initially. An administrator must approve
                  your request to become a {requestedRole === 'student' ? 'Student' : 'Admin'}.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-4 mt-8 font-bold text-blue-600 neu-button transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating account...' : 'Create account'}
              {!submitting && <UserPlus size={18} />}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

