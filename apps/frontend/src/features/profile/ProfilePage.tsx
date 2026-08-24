import { useEffect, useState } from 'react';
import { apiRequest } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { UserDto, MIS_BRANCHES } from '@nest/shared-types';
import { Pencil, Camera, Lock, X } from 'lucide-react';
import { updateProfile, updatePassword } from '../../api-client/users';

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  stores_manager: 'Stores Manager',
  contributor: 'Contributor',
  student: 'Student',
  viewer: 'Viewer',
};

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

export function ProfilePage() {
  const { user: ctxUser } = useAuth();
  const [profile, setProfile] = useState<UserDto | null>(ctxUser);
  const [loading, setLoading] = useState(!ctxUser);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [formInput, setFormInput] = useState<string>('');
  const [formInput2, setFormInput2] = useState<string>(''); // For new password
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctxUser) return;
    apiRequest<UserDto>(`/users/${ctxUser.id}`, { method: 'GET' })
      .then(setProfile)
      .catch(() => setError('Could not load profile details.'))
      .finally(() => setLoading(false));
  }, [ctxUser]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-sm animate-pulse">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error ?? 'Profile not found.'}</p>
      </div>
    );
  }

  const handleEdit = (field: string) => {
    setActiveModal(field);
    setModalError(null);
    if (field === 'Display Name') setFormInput(profile.display_name);
    else if (field === 'MIS ID') setFormInput(profile.mis_id || '');
    else if (field === 'Gender') setFormInput(profile.gender || '');
    else {
      setFormInput('');
      setFormInput2('');
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      if (activeModal === 'Password') {
        if (formInput2.length < 8) throw new Error('New password must be at least 8 characters');
        const updated = await updatePassword({ currentPassword: formInput, newPassword: formInput2 });
        setProfile(updated);
      } else {
        const updateData: any = {};
        if (activeModal === 'Display Name') updateData.displayName = formInput;
        else if (activeModal === 'MIS ID') updateData.misId = formInput;
        else if (activeModal === 'Gender') updateData.gender = formInput;
        const updated = await updateProfile(updateData);
        setProfile(updated);
      }
      setActiveModal(null);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your personal information and account settings.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header / Avatar Area */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-transparent">
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer" onClick={() => handleEdit('Profile Picture')}>
              <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-md group-hover:opacity-90 transition-opacity">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" size={24} />
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{profile.display_name}</h2>
                <button onClick={() => handleEdit('Display Name')} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Edit Name">
                  <Pencil size={16} />
                </button>
              </div>
              <p className="text-gray-500 mt-0.5">{profile.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </span>
                {profile.pending_role && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 uppercase tracking-wider">
                    Pending: {ROLE_LABELS[profile.pending_role] ?? profile.pending_role}
                  </span>
                )}
                {profile.is_active ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 uppercase tracking-wider">
                    Deactivated
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <button 
              onClick={() => handleEdit('Password')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm"
            >
              <Lock size={16} /> Change Password
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Personal Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            
            <div className="group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</span>
              </div>
              <div className="text-gray-900 font-medium">{profile.email}</div>
            </div>

            <div className="group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">MIS ID</span>
                <button onClick={() => handleEdit('MIS ID')} className="text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="text-gray-900 font-medium">
                {profile.mis_id || <span className="text-gray-400 italic font-normal">Not provided</span>}
              </div>
              {profile.mis_id && parseMisId(profile.mis_id) && (
                <div className="text-sm text-gray-500 mt-0.5">
                  {parseMisId(profile.mis_id)}
                </div>
              )}
            </div>

            <div className="group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</span>
                <button onClick={() => handleEdit('Gender')} className="text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100">
                  <Pencil size={14} />
                </button>
              </div>
              <div className="text-gray-900 font-medium">
                {profile.gender ? (GENDER_LABELS[profile.gender] ?? profile.gender) : <span className="text-gray-400 italic font-normal">Not provided</span>}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Member Since</span>
              </div>
              <div className="text-gray-900 font-medium">
                {new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-md p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Change {activeModal}</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={submitEdit} className="space-y-4">
              {modalError && (
                <div className="p-3 text-sm rounded bg-red-50 text-red-800">
                  {modalError}
                </div>
              )}

              {activeModal === 'Password' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input 
                      type="password" 
                      required 
                      value={formInput} 
                      onChange={e => setFormInput(e.target.value)} 
                      className="w-full border rounded px-3 py-2 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input 
                      type="password" 
                      required 
                      value={formInput2} 
                      onChange={e => setFormInput2(e.target.value)} 
                      className="w-full border rounded px-3 py-2 text-sm" 
                    />
                  </div>
                </>
              ) : activeModal === 'Gender' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select 
                    value={formInput} 
                    onChange={e => setFormInput(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select Gender</option>
                    {Object.entries(GENDER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{activeModal}</label>
                  <input 
                    type="text" 
                    required={activeModal !== 'MIS ID'} 
                    value={formInput} 
                    onChange={e => setFormInput(e.target.value)} 
                    className="w-full border rounded px-3 py-2 text-sm" 
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
