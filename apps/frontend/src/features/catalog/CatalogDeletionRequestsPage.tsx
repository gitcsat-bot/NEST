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
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Catalog Deletion Requests</h1>
        <p className="text-sm font-medium text-gray-600">
          Catalog items students and other non-admin roles have asked to have removed.
        </p>
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
        <p className="text-gray-500 text-sm font-medium">No pending deletion requests.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((req) => (
            <div key={req.id} className="neu-flat rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="mb-4 border-b border-gray-200/50 pb-4">
                  <div className="font-bold text-gray-700 text-lg truncate">{req.asset_definition_name}</div>
                  <div className="text-xs font-mono text-gray-500 mt-1">{req.asset_definition_sku}</div>
                </div>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Requested By</span>
                    <span className="font-medium text-gray-700">{req.requested_by_display_name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 font-medium">Reason</span>
                    <span className="font-medium text-gray-500 italic neu-inset p-3 rounded-xl block mt-2 text-sm">{req.reason ?? 'No reason provided'}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500 font-medium">Submitted</span>
                    <span className="font-medium text-gray-700">{new Date(req.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200/50 mt-auto justify-end">
                <button
                  type="button"
                  disabled={actingOnId === req.id}
                  onClick={() => handleDecision(req.id, 'reject')}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 neu-button disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={actingOnId === req.id}
                  onClick={() => handleDecision(req.id, 'approve')}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-red-600 neu-button disabled:opacity-50"
                  title="This permanently deletes the catalog item"
                >
                  Approve &amp; Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
