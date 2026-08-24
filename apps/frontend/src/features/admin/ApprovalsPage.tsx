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
    <div>
      <h1 className="text-xl font-semibold mb-2">Users &amp; Approvals</h1>
      <p className="text-sm text-gray-600 mb-4">
        {view === 'pending'
          ? 'Accounts that registered requesting a role above viewer, awaiting admin sign-off.'
          : 'Every account and its current role. A pending row still shows Approve/Reject.'}
      </p>

      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => {
            setView('pending');
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === 'pending' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Pending approvals
        </button>
        <button
          onClick={() => {
            setView('all');
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === 'all' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          All users
        </button>
        <button
          onClick={() => {
            setView('students');
            setPage(1);
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === 'students' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Students
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded p-3 text-sm"
          style={{ background: '#fef2f2', color: 'var(--nest-color-danger)' }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {view === 'pending' ? 'No pending role requests.' : 'No users found.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 px-2">User</th>
                <th className="py-2 px-2">Role</th>
                <th className="py-2 px-2">Pending role</th>
                {view === 'all' && <th className="py-2 px-2">Status</th>}
                {view === 'students' && (
                  <>
                    <th className="py-2 px-2">WhatsApp</th>
                    <th className="py-2 px-2">Subsystem</th>
                    <th className="py-2 px-2">Team Role</th>
                  </>
                )}
                <th className="py-2 px-2">Registered</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">
                    <div className="font-medium">{u.display_name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs uppercase">{u.role}</td>
                  <td className="py-2 px-2 font-mono text-xs uppercase font-semibold">
                    {u.pending_role ?? <span className="text-gray-400 font-normal normal-case">—</span>}
                  </td>
                  {view === 'all' && (
                    <td className="py-2 px-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs"
                        style={
                          u.is_active
                            ? { background: '#ecfdf5', color: '#047857' }
                            : { background: '#f3f4f6', color: '#6b7280' }
                        }
                      >
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                  )}
                  {view === 'students' && (
                    <>
                      <td className="py-2 px-2 text-xs">{u.whatsapp_number ?? '—'}</td>
                      <td className="py-2 px-2 text-xs">{u.subsystem ?? '—'}</td>
                      <td className="py-2 px-2 text-xs">{u.team_role ?? '—'}</td>
                    </>
                  )}
                  <td className="py-2 px-2 text-gray-500">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-2">
                      {u.pending_role && (
                        <>
                          <button
                            type="button"
                            disabled={actingOnId === u.id}
                            onClick={() => handleDecision(u.id, 'approve')}
                            className="text-xs px-2 py-1 rounded text-white disabled:opacity-60"
                            style={{ background: 'var(--nest-color-accent)' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actingOnId === u.id}
                            onClick={() => handleDecision(u.id, 'reject')}
                            className="text-xs px-2 py-1 rounded border disabled:opacity-60"
                            style={{ color: 'var(--nest-color-danger)' }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {view === 'all' && (
                        <button
                          type="button"
                          disabled={actingOnId === u.id}
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          className="text-xs px-2 py-1 rounded border disabled:opacity-60"
                          style={{ color: u.is_active ? 'var(--nest-color-danger)' : '#047857', borderColor: u.is_active ? 'var(--nest-color-danger)' : '#047857' }}
                        >
                          {u.is_active ? 'Suspend' : 'Restore'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'all' && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">{total} total</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded border disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 py-1">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded border disabled:opacity-40"
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
