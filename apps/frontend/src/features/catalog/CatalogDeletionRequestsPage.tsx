import { useState, useEffect } from 'react';
import {
  CatalogDeletionRequestDto,
  listCatalogDeletionRequests,
  approveCatalogDeletionRequest,
  rejectCatalogDeletionRequest,
} from '../../api-client/catalog-deletion-requests';
import { ApiError } from '../../api-client/client';

// Admin-only queue for the student "request catalog item deletion"
// workflow. Mirrors InventoryRequestsPage.tsx deliberately — same
// shape of problem (student requests, admin approves/rejects), same UI
// pattern, matching the backend's parallel structure
// (deletion-requests.service.ts's doc comment explains why).
export function CatalogDeletionRequestsPage() {
  const [items, setItems] = useState<CatalogDeletionRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await listCatalogDeletionRequests({ status: 'pending' });
      setItems(result.items);
    } catch {
      setError('Failed to load deletion requests.');
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
        await approveCatalogDeletionRequest(id);
      } else {
        await rejectCatalogDeletionRequest(id);
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
      <h1 className="text-xl font-semibold mb-6">Catalog Deletion Requests</h1>
      <p className="text-sm text-gray-600 mb-4">
        Catalog items students and other non-admin roles have asked to have removed.
      </p>

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
        <p className="text-gray-500 text-sm">No pending deletion requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 px-2">Item</th>
                <th className="py-2 px-2">Requested by</th>
                <th className="py-2 px-2">Reason</th>
                <th className="py-2 px-2">Submitted</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((req) => (
                <tr key={req.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">
                    <div className="font-medium">{req.asset_definition_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{req.asset_definition_sku}</div>
                  </td>
                  <td className="py-2 px-2">{req.requested_by_display_name}</td>
                  <td className="py-2 px-2 text-gray-600">{req.reason ?? '—'}</td>
                  <td className="py-2 px-2 text-gray-500">{new Date(req.created_at).toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actingOnId === req.id}
                        onClick={() => handleDecision(req.id, 'approve')}
                        className="text-xs px-2 py-1 rounded text-white disabled:opacity-60"
                        style={{ background: 'var(--nest-color-danger)' }}
                        title="This permanently deletes the catalog item"
                      >
                        Approve &amp; Delete
                      </button>
                      <button
                        type="button"
                        disabled={actingOnId === req.id}
                        onClick={() => handleDecision(req.id, 'reject')}
                        className="text-xs px-2 py-1 rounded border disabled:opacity-60"
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
