import { useState, useEffect } from 'react';
import { UserDto } from '@nest/shared-types';
import { listUsers, approveUserRole, rejectUserRole, deactivateUser, reactivateUser } from '../../api-client/users';
import { ApiError } from '../../api-client/client';
import { useStepUp } from '../../app/useStepUp';

type ViewMode = 'pending' | 'all' | 'students';

// Admin Approvals + user roster. Two views on the same `GET /users` data:
//   - "Pending approvals" — the has_pending_role=true filter, so an admin
//     can see and act on registration requests without hunting for them.
//   - "All users" — every account and its current role, so an admin can
//     answer "what role does this account have" without a pending
//     request to prompt it. A row with a pending role still shows the
//     Approve/Reject actions inline here too.
// Both actions are @RequireStepUp() on the backend (TDS §12.3: role
// changes), so both are wrapped in useStepUp.
export function ApprovalsPage() {
  const [view, setView] = useState<ViewMode>('pending');
  const [items, setItems] = useState<UserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const { withStepUp, modal } = useStepUp();

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result =
        view === 'pending'
          ? await listUsers({ has_pending_role: true })
          : view === 'students'
          ? await listUsers({ role: 'student', page, page_size: 25 })
          : await listUsers({ page, page_size: 25 });
      setItems(result.items);
      setTotal(result.total);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [view, page]);

  async function handleDecision(id: string, decision: 'approve' | 'reject') {
    setActingOnId(id);
    setError(null);
    try {
      const updated = await withStepUp(() =>
        decision === 'approve' ? approveUserRole(id) : rejectUserRole(id),
      );
      if (view === 'pending') {
        setItems((prev) => prev.filter((u) => u.id !== id));
      } else {
        // In the "All users" view, keep the row — just reflect the new
        // role/cleared pending_role instead of removing it from the list.
        setItems((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record decision.');
    } finally {
      setActingOnId(null);
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    if (!confirm(`Are you sure you want to ${isActive ? 'deactivate' : 'reactivate'} this user?`)) return;
    setActingOnId(id);
    setError(null);
    try {
      const updated = await withStepUp(() =>
        isActive ? deactivateUser(id) : reactivateUser(id),
      );
      setItems((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update user status.');
    } finally {
      setActingOnId(null);
    }
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Users &amp; Approvals</h1>
        <p className="text-sm font-medium text-gray-600">
          {view === 'pending'
            ? 'Accounts that registered requesting a role above viewer, awaiting admin sign-off.'
            : 'Every account and its current role. A pending row still shows Approve/Reject.'}
        </p>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={() => {
            setView('pending');
            setPage(1);
          }}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            view === 'pending' ? 'neu-button text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending approvals
        </button>
        <button
          onClick={() => {
            setView('all');
            setPage(1);
          }}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            view === 'all' ? 'neu-button text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All users
        </button>
        <button
          onClick={() => {
            setView('students');
            setPage(1);
          }}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            view === 'students' ? 'neu-button text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Students
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-8 rounded-xl p-4 text-sm neu-inset text-red-600 font-medium"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm font-medium">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm font-medium">
          {view === 'pending' ? 'No pending role requests.' : 'No users found.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((u) => (
            <div key={u.id} className="neu-flat rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4 border-b border-gray-200/50 pb-4">
                  <div className="overflow-hidden">
                    <div className="font-bold text-gray-700 text-lg truncate">{u.display_name}</div>
                    <div className="text-xs text-gray-500 font-medium truncate mt-1">{u.email}</div>
                  </div>
                  {view === 'all' && (
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold neu-inset ${
                        u.is_active ? 'text-emerald-600' : 'text-gray-500'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Role</span>
                    <span className="font-mono font-bold text-gray-700 uppercase">{u.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Pending Role</span>
                    <span className="font-mono font-bold text-blue-600 uppercase">
                      {u.pending_role ?? <span className="text-gray-400 font-normal normal-case">—</span>}
                    </span>
                  </div>
                  {view === 'students' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">WhatsApp</span>
                        <span className="font-medium text-gray-700">{u.whatsapp_number ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Subsystem</span>
                        <span className="font-medium text-gray-700">{u.subsystem ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-medium">Team Role</span>
                        <span className="font-medium text-gray-700">{u.team_role ?? '—'}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Registered</span>
                    <span className="font-medium text-gray-700">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200/50 mt-auto justify-end">
                {u.pending_role && (
                  <>
                    <button
                      type="button"
                      disabled={actingOnId === u.id}
                      onClick={() => handleDecision(u.id, 'reject')}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 neu-button disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={actingOnId === u.id}
                      onClick={() => handleDecision(u.id, 'approve')}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-emerald-600 neu-button disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </>
                )}
                {view === 'all' && (
                  <button
                    type="button"
                    disabled={actingOnId === u.id}
                    onClick={() => handleToggleActive(u.id, u.is_active)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold neu-button disabled:opacity-50 ${
                      u.is_active ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {u.is_active ? 'Suspend' : 'Restore'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'all' && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 text-sm">
          <span className="text-gray-500 font-medium">{total} total items</span>
          <div className="flex gap-3 items-center">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 rounded-xl font-bold text-gray-700 neu-button disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-3 py-2 rounded-xl neu-inset font-bold text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 rounded-xl font-bold text-gray-700 neu-button disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {modal}
    </div>
  );
}
