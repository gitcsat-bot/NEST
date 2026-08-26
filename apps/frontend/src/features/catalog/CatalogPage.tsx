import { useState, useEffect, FormEvent } from 'react';
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
            className="neu-button px-6 py-2.5 rounded-xl text-sm font-bold text-blue-600 transition-all"
          >
            {showCreate ? 'Cancel' : '+ New Definition'}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search by name, SKU, or manufacturer…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700"
        />
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="neu-flat rounded-xl p-6 mb-8 space-y-5">
          <h3 className="text-lg font-semibold text-gray-700 border-b border-gray-200/50 pb-3">New Asset Definition</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">SKU *</label>
              <input required value={newSku} onChange={(e) => setNewSku(e.target.value)}
                className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Name *</label>
              <input required value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Manufacturer</label>
              <input value={newManufacturer} onChange={(e) => setNewManufacturer(e.target.value)}
                className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Model Number</label>
              <input value={newModelNumber} onChange={(e) => setNewModelNumber(e.target.value)}
                className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Description</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
              className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700 resize-y" rows={3} />
          </div>
          <div className="flex gap-6 py-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 font-medium cursor-pointer">
              <input type="checkbox" checked={newIsConsumable} onChange={(e) => setNewIsConsumable(e.target.checked)} className="rounded text-blue-600" />
              Consumable
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 font-medium cursor-pointer">
              <input type="checkbox" checked={newRequiresReturn} onChange={(e) => setNewRequiresReturn(e.target.checked)} className="rounded text-blue-600" />
              Requires Return
            </label>
          </div>
          <button type="submit" disabled={creating}
            className="neu-button rounded-xl px-6 py-3 font-medium text-blue-600 disabled:opacity-50">
            {creating ? 'Creating…' : 'Create Definition'}
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="mb-6 rounded-xl p-4 text-sm neu-inset text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">No asset definitions found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.id} className="neu-flat rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-700 truncate pr-2">{item.name}</h3>
                  <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-1 rounded shadow-inner flex-shrink-0">
                    {item.sku}
                  </span>
                </div>
                
                <div className="space-y-1 mb-4 text-sm text-gray-600">
                  <p><span className="font-medium">Manufacturer:</span> {item.manufacturer || '—'}</p>
                  <p><span className="font-medium">Model:</span> {item.model_number || '—'}</p>
                  <div className="flex gap-4 pt-1">
                    {item.is_consumable && <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 rounded-full text-xs font-medium">Consumable</span>}
                    {item.requires_return && <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 rounded-full text-xs font-medium">Requires Return</span>}
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="text-sm text-gray-600 neu-inset rounded-lg p-3 mb-4 whitespace-pre-wrap">
                    <strong className="block mb-1 text-gray-700">Description:</strong>
                    {item.description || <span className="italic text-gray-400">No description provided.</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200/50 mt-auto">
                <button 
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {expandedId === item.id ? 'Hide Details' : 'View Details'}
                </button>

                {(canDelete || canRequestDeletion) && (
                  <div>
                    {canDelete && (
                      <button onClick={() => handleDelete(item.id)}
                        className="text-sm px-3 py-1.5 rounded-lg neu-button text-red-600 font-medium">
                        Delete
                      </button>
                    )}
                    {!canDelete && canRequestDeletion && (
                      requestedDeletionIds.has(item.id) ? (
                        <span className="text-sm text-gray-500 italic">Requested</span>
                      ) : (
                        <button
                          onClick={() => handleRequestDeletion(item.id)}
                          disabled={requestingDeletionId === item.id}
                          className="text-sm px-3 py-1.5 rounded-lg neu-button text-red-600 font-medium disabled:opacity-50"
                        >
                          Request Delete
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 text-sm">
          <span className="text-gray-500 font-medium">{total} total items</span>
          <div className="flex gap-3 items-center">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-4 py-2 neu-button rounded-xl disabled:opacity-40 font-medium text-gray-700">
              Previous
            </button>
            <span className="px-3 py-2 neu-inset rounded-xl font-medium text-gray-700">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="px-4 py-2 neu-button rounded-xl disabled:opacity-40 font-medium text-gray-700">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
