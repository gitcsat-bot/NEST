import { useState, useEffect, FormEvent, useRef } from 'react';
import { UserRole, roleAtLeast, MaterialDto } from '@nest/shared-types';
import { useAuth } from '../../app/AuthContext';
import { listMaterials, createMaterial } from '../../api-client/materials';
import { listAssetDefinitions, AssetDefinitionDto } from '../../api-client/catalog';
import { fetchLocations } from '../../api-client/locations';
import { ApiError, apiRequest } from '../../api-client/client';

export function MaterialsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MaterialDto[]>([]);
  const [_total, setTotal] = useState(0);
  const [page, _setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add material modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [assetDefs, setAssetDefs] = useState<AssetDefinitionDto[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [newMaterial, setNewMaterial] = useState({
    asset_definition_id: '',
    location_id: '',
    quantity_on_hand: 0,
    unit: 'pcs'
  });

  // CSV
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user && roleAtLeast(user.role as UserRole, UserRole.STORES_MANAGER);

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

  async function fetchDropdowns() {
    try {
      const defs = await listAssetDefinitions({ page_size: 100 });
      setAssetDefs(defs.items);
      const locs = await fetchLocations();
      setLocations(locs);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchData();
  }, [page]);

  useEffect(() => {
    if (showAddModal) {
      fetchDropdowns();
    }
  }, [showAddModal]);

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createMaterial({
        asset_definition_id: newMaterial.asset_definition_id,
        location_id: newMaterial.location_id,
        quantity_on_hand: newMaterial.quantity_on_hand
      });
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add material');
    }
  }

  async function handleDownloadCsv() {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const res = await fetch(`${baseUrl}/inventory/csv/template`, {
        credentials: 'include' // Needed for the HttpOnly session cookie
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory_template.csv';
      a.click();
    } catch (e) {
      setError('Download failed.');
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest<{ message?: string }>('/inventory/csv/upload', {
        method: 'POST',
        body: formData
      });
      alert(res.message || 'CSV uploaded successfully!');
      fetchData();
      if (e.target) e.target.value = ''; // Reset input so same file can be uploaded again
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl font-semibold text-gray-700">Inventory</h1>
        <div className="flex gap-3">
          {isAdmin && (
            <>
              <button onClick={handleDownloadCsv} className="neu-button px-4 py-2 text-sm text-blue-600">
                Download Template
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="neu-button px-4 py-2 text-sm text-blue-600">
                Upload CSV
              </button>
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvUpload} />
              <button onClick={() => setShowAddModal(true)} className="neu-button px-4 py-2 text-sm font-medium text-green-600">
                + Add Material
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="neu-inset mb-6 rounded p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {showAddModal && (
        <div className="neu-flat rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 text-gray-700 border-b border-gray-200/50 pb-4">Add New Material</h2>
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-6 max-w-md">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">Asset Definition</label>
              <select 
                required
                value={newMaterial.asset_definition_id}
                onChange={e => setNewMaterial(prev => ({ ...prev, asset_definition_id: e.target.value }))}
                className="neu-inset w-full px-4 py-3.5 rounded-xl text-gray-700 outline-none bg-transparent appearance-none font-medium"
              >
                <option value="">Select an asset...</option>
                {assetDefs.map(def => <option key={def.id} value={def.id}>{def.name} ({def.sku})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">Location</label>
              <select 
                value={newMaterial.location_id}
                onChange={e => setNewMaterial(prev => ({ ...prev, location_id: e.target.value }))}
                className="neu-inset w-full px-4 py-3.5 rounded-xl text-gray-700 outline-none bg-transparent appearance-none font-medium"
              >
                <option value="">Select location (optional)</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">Quantity On Hand</label>
              <input 
                type="number" min="0" required
                value={newMaterial.quantity_on_hand}
                onChange={e => setNewMaterial(prev => ({ ...prev, quantity_on_hand: Number(e.target.value) }))}
                className="neu-inset w-full px-4 py-3.5 rounded-xl text-gray-700 outline-none font-medium"
              />
            </div>
            <div className="flex gap-4 mt-4">
              <button type="submit" className="neu-button flex-1 rounded-xl py-3 font-bold text-blue-600 transition-all">Save</button>
              <button type="button" onClick={() => setShowAddModal(false)} className="neu-button flex-1 rounded-xl py-3 font-bold text-gray-600 transition-all">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm">No materials found.</p>
        ) : (
          items.map(material => (
            <div key={material.id} className="neu-flat p-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="font-semibold text-gray-700">{material.asset_definition_name}</h3>
                <p className="text-xs text-gray-500 font-mono mb-1">{material.asset_definition_sku}</p>
                <p className="text-sm text-gray-600">Location: {material.location_name ?? '—'}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <p className="text-sm font-medium text-gray-700">{material.status}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Stock</p>
                  <p className="text-xl font-semibold text-blue-600">{material.quantity_on_hand}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
