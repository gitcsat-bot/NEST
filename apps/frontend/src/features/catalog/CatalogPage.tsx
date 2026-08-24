import { useState, useEffect, FormEvent, Fragment } from 'react';
import { UserRole, roleAtLeast } from '@nest/shared-types';
import { useAuth } from '../../app/AuthContext';
import {
  AssetDefinitionDto,
  listAssetDefinitions,
  createAssetDefinition,
  deleteAssetDefinition,
} from '../../api-client/catalog';
import { requestCatalogDeletion } from '../../api-client/catalog-deletion-requests';
import { ApiError } from '../../api-client/client';

export function CatalogPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AssetDefinitionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newModelNumber, setNewModelNumber] = useState('');
  const [newIsConsumable, setNewIsConsumable] = useState(false);
  const [newRequiresReturn, setNewRequiresReturn] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Student-side "request deletion" — tracked client-side per item once
  // submitted this session (the server is still the source of truth: a
  // second click just surfaces the backend's "already pending" conflict
  // message via `error` below).
  const [requestedDeletionIds, setRequestedDeletionIds] = useState<Set<string>>(new Set());
  const [requestingDeletionId, setRequestingDeletionId] = useState<string | null>(null);

  const canCreate = user && roleAtLeast(user.role as UserRole, UserRole.CONTRIBUTOR);
  const canDelete = user && user.role === UserRole.ADMIN;
  // Admins already get the immediate Delete button above — the request-
  // based flow is for everyone below admin who can still act on the
  // catalog (student and up), matching materials.controller.ts's
  // @Roles(UserRole.STUDENT) gate on the equivalent backend endpoint.
  const canRequestDeletion = user && roleAtLeast(user.role as UserRole, UserRole.STUDENT) && user.role !== UserRole.ADMIN;

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await listAssetDefinitions({ search: search || undefined, page });
      setItems(result.items);
      setTotal(result.total);
    } catch {
      setError('Failed to load catalog.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [page, search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createAssetDefinition({
        sku: newSku,
        name: newName,
        description: newDescription || undefined,
        manufacturer: newManufacturer || undefined,
        model_number: newModelNumber || undefined,
        is_consumable: newIsConsumable,
        requires_return: newRequiresReturn,
      });
      setShowCreate(false);
      setNewSku('');
      setNewName('');
      setNewDescription('');
      setNewManufacturer('');
      setNewModelNumber('');
      setNewIsConsumable(false);
      setNewRequiresReturn(false);
      fetchData();
    } catch {
      setError('Failed to create asset definition.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this asset definition?')) return;
    try {
      await deleteAssetDefinition(id);
      fetchData();
    } catch {
      setError('Failed to delete asset definition.');
    }
  }

  async function handleRequestDeletion(id: string) {
    if (!confirm('Request that an admin delete this asset definition?')) return;
    setRequestingDeletionId(id);
    setError(null);
    try {
      await requestCatalogDeletion(id);
      setRequestedDeletionIds((prev) => new Set(prev).add(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit deletion request.');
    } finally {
      setRequestingDeletionId(null);
    }
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Catalog — Asset Definitions</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded px-4 py-2 font-medium text-white"
            style={{ background: 'var(--nest-color-accent)', borderRadius: 'var(--nest-radius)' }}
          >
            {showCreate ? 'Cancel' : '+ New Definition'}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, SKU, or manufacturer…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded border px-3 py-2"
          style={{ borderRadius: 'var(--nest-radius)' }}
        />
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded p-4 mb-6 space-y-3" style={{ borderRadius: 'var(--nest-radius)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">SKU *</label>
              <input required value={newSku} onChange={(e) => setNewSku(e.target.value)}
                className="w-full rounded border px-3 py-2" style={{ borderRadius: 'var(--nest-radius)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input required value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded border px-3 py-2" style={{ borderRadius: 'var(--nest-radius)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Manufacturer</label>
              <input value={newManufacturer} onChange={(e) => setNewManufacturer(e.target.value)}
                className="w-full rounded border px-3 py-2" style={{ borderRadius: 'var(--nest-radius)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model Number</label>
              <input value={newModelNumber} onChange={(e) => setNewModelNumber(e.target.value)}
                className="w-full rounded border px-3 py-2" style={{ borderRadius: 'var(--nest-radius)' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
              className="w-full rounded border px-3 py-2" rows={2} style={{ borderRadius: 'var(--nest-radius)' }} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newIsConsumable} onChange={(e) => setNewIsConsumable(e.target.checked)} />
              Consumable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newRequiresReturn} onChange={(e) => setNewRequiresReturn(e.target.checked)} />
              Requires Return
            </label>
          </div>
          <button type="submit" disabled={creating}
            className="rounded px-4 py-2 font-medium text-white disabled:opacity-60"
            style={{ background: 'var(--nest-color-accent)', borderRadius: 'var(--nest-radius)' }}>
            {creating ? 'Creating…' : 'Create Definition'}
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="mb-4 rounded p-3 text-sm"
          style={{ background: '#fef2f2', color: 'var(--nest-color-danger)' }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">No asset definitions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 px-2">SKU</th>
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Manufacturer</th>
                <th className="py-2 px-2">Model</th>
                <th className="py-2 px-2">Consumable</th>
                <th className="py-2 px-2">Returns</th>
                {(canDelete || canRequestDeletion) && <th className="py-2 px-2"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr 
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <td className="py-2 px-2 font-mono text-xs">{item.sku}</td>
                    <td className="py-2 px-2">{item.name}</td>
                    <td className="py-2 px-2">{item.manufacturer ?? '—'}</td>
                    <td className="py-2 px-2">{item.model_number ?? '—'}</td>
                    <td className="py-2 px-2">{item.is_consumable ? '✓' : '—'}</td>
                    <td className="py-2 px-2">{item.requires_return ? '✓' : '—'}</td>
                    {(canDelete || canRequestDeletion) && (
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        {canDelete && (
                          <button onClick={() => handleDelete(item.id)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ color: 'var(--nest-color-danger)' }}>
                            Delete
                          </button>
                        )}
                        {!canDelete && canRequestDeletion && (
                          requestedDeletionIds.has(item.id) ? (
                            <span className="text-xs text-gray-500 italic">Requested</span>
                          ) : (
                            <button
                              onClick={() => handleRequestDeletion(item.id)}
                              disabled={requestingDeletionId === item.id}
                              className="text-xs px-2 py-1 rounded border disabled:opacity-60"
                              style={{ color: 'var(--nest-color-danger)' }}
                            >
                              Request Delete
                            </button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                  {expandedId === item.id && (
                    <tr className="bg-gray-50 border-b">
                      <td colSpan={canDelete || canRequestDeletion ? 7 : 6} className="px-4 py-3">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          <strong>Description:</strong><br />
                          {item.description || <span className="italic text-gray-400">No description provided.</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">{total} total</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded border disabled:opacity-40">
              Previous
            </button>
            <span className="px-2 py-1">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded border disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
