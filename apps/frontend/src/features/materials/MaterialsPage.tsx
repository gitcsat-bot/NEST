import { useState, useEffect, FormEvent, Fragment } from 'react';
import { UserRole, roleAtLeast, AssetStatus, MATERIAL_STATUS_TRANSITIONS, MaterialDto } from '@nest/shared-types';
import { useAuth } from '../../app/AuthContext';
import { listMaterials, updateMaterialStatus, requestMaterialQuantity } from '../../api-client/materials';
import { ApiError } from '../../api-client/client';

// Materials MVP (Implementation Plan checklist items 4/5). See the doc
// comment on the `Material` model in schema.prisma for why this is a
// simplified single-table MVP rather than the full Individually Tracked
// Assets design.
export function MaterialsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MaterialDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline "request quantity" form, one at a time, keyed by material id.
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestQty, setRequestQty] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canWrite = user && roleAtLeast(user.role as UserRole, UserRole.STUDENT);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await listMaterials({ page });
      setItems(result.items);
      setTotal(result.total);
    } catch {
      setError('Failed to load materials.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [page]);

  async function handleStatusChange(material: MaterialDto, newStatus: AssetStatus) {
    setError(null);
    try {
      const updated = await updateMaterialStatus(material.id, { status: newStatus });
      setItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change status.');
    }
  }

  async function handleRequestSubmit(e: FormEvent, materialId: string) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestMaterialQuantity(materialId, {
        requested_quantity: Number(requestQty),
        reason: requestReason || undefined,
      });
      setRequestingId(null);
      setRequestQty('');
      setRequestReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Materials</h1>
        {user && user.role === UserRole.ADMIN && (
          <button className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">
            Add Material
          </button>
        )}
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
        <p className="text-gray-500 text-sm">No materials found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 px-2">Item</th>
                <th className="py-2 px-2">Location</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">On hand</th>
                {canWrite && <th className="py-2 px-2"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((material) => {
                const allowedNext = MATERIAL_STATUS_TRANSITIONS[material.status] ?? [];
                const lowStock =
                  material.reorder_threshold !== null && material.quantity_on_hand <= material.reorder_threshold;
                return (
                  <Fragment key={material.id}>
                    <tr className="border-b hover:bg-gray-50 align-top">
                      <td className="py-2 px-2">
                        <div className="font-medium">{material.asset_definition_name}</div>
                        <div className="text-xs text-gray-500 font-mono">{material.asset_definition_sku}</div>
                      </td>
                      <td className="py-2 px-2">{material.location_name ?? '—'}</td>
                      <td className="py-2 px-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-mono uppercase"
                          style={{ background: '#eef2ff' }}
                        >
                          {material.status}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={lowStock ? 'font-semibold' : ''} style={lowStock ? { color: 'var(--nest-color-danger)' } : undefined}>
                          {material.quantity_on_hand}
                        </span>
                        {material.reorder_threshold !== null && (
                          <span className="text-xs text-gray-400"> / reorder at {material.reorder_threshold}</span>
                        )}
                      </td>
                      {canWrite && (
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-2 items-center">
                            {allowedNext.length > 0 && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) handleStatusChange(material, e.target.value as AssetStatus);
                                  e.target.value = '';
                                }}
                                className="text-xs rounded border px-2 py-1"
                              >
                                <option value="" disabled>
                                  Change status…
                                </option>
                                {allowedNext.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => setRequestingId(requestingId === material.id ? null : material.id)}
                              className="text-xs px-2 py-1 rounded border"
                            >
                              {requestingId === material.id ? 'Cancel' : 'Request qty'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {requestingId === material.id && (
                      <tr className="border-b bg-gray-50">
                        <td colSpan={canWrite ? 5 : 4} className="py-3 px-2">
                          <form
                            onSubmit={(e) => handleRequestSubmit(e, material.id)}
                            className="flex flex-wrap items-end gap-3"
                          >
                            <div>
                              <label className="block text-xs font-medium mb-1">Quantity needed *</label>
                              <input
                                type="number"
                                min={1}
                                required
                                value={requestQty}
                                onChange={(e) => setRequestQty(e.target.value)}
                                className="w-28 rounded border px-2 py-1 text-sm"
                              />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                              <label className="block text-xs font-medium mb-1">Reason</label>
                              <input
                                value={requestReason}
                                onChange={(e) => setRequestReason(e.target.value)}
                                className="w-full rounded border px-2 py-1 text-sm"
                                placeholder="Optional — helps the reviewer"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={submitting}
                              className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                              style={{ background: 'var(--nest-color-accent)' }}
                            >
                              {submitting ? 'Submitting…' : 'Submit request'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
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
    </div>
  );
}
