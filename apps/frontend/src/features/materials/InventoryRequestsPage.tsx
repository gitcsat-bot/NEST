import { useState, useEffect } from 'react';
import { InventoryRequestDto } from '@nest/shared-types';
import { listInventoryRequests, approveInventoryRequest, rejectInventoryRequest } from '../../api-client/materials';
import { ApiError } from '../../api-client/client';

// Admin-only queue for the student "request quantity" workflow
// (Implementation Plan checklist items 4/5). Approving/rejecting isn't in
// TDS §12.3's step-up list, so this page doesn't need useStepUp — see
// ApprovalsPage.tsx for that pattern where it does apply.
export function InventoryRequestsPage() {
  const [items, setItems] = useState<InventoryRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await listInventoryRequests({ status: 'pending' });
      setItems(result.items);
    } catch {
      setError('Failed to load inventory requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleDecision(id: string, decision: 'approve' | 'reject') {
    setActingOnId(id);
    setError(null);
    try {
      if (decision === 'approve') {
        await approveInventoryRequest(id);
      } else {
        await rejectInventoryRequest(id);
      }
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record decision.');
    } finally {
      setActingOnId(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Inventory Requests</h1>
      <p className="text-sm text-gray-600 mb-4">Pending quantity requests submitted by students and admins.</p>

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
        <p className="text-gray-500 text-sm">No pending requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 px-2">Material</th>
                <th className="py-2 px-2">Requested by</th>
                <th className="py-2 px-2">Quantity</th>
                <th className="py-2 px-2">Reason</th>
                <th className="py-2 px-2">Submitted</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((req) => (
                <tr key={req.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium">{req.material_name}</td>
                  <td className="py-2 px-2">{req.requested_by_display_name}</td>
                  <td className="py-2 px-2">{req.requested_quantity}</td>
                  <td className="py-2 px-2 text-gray-600">{req.reason ?? '—'}</td>
                  <td className="py-2 px-2 text-gray-500">{new Date(req.created_at).toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actingOnId === req.id}
                        onClick={() => handleDecision(req.id, 'approve')}
                        className="text-xs px-2 py-1 rounded text-white disabled:opacity-60"
                        style={{ background: 'var(--nest-color-accent)' }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingOnId === req.id}
                        onClick={() => handleDecision(req.id, 'reject')}
                        className="text-xs px-2 py-1 rounded border disabled:opacity-60"
                        style={{ color: 'var(--nest-color-danger)' }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
