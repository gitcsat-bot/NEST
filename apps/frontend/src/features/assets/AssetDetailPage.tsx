import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api-client/client';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadAsset() {
    setLoading(true);
    try {
      const data = await apiRequest<any>(`/assets/${id}`, { method: 'GET' });
      setAsset(data);
    } catch (err) {
      console.error('Failed to load asset', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAsset();
  }, [id]);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      await apiRequest(`/checkouts/${id}/checkout`, { 
        method: 'POST', 
        body: { heldByUserId: targetUserId } 
      });
      setShowCheckout(false);
      loadAsset();
    } catch (err) {
      alert('Checkout failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckin() {
    setActionLoading(true);
    try {
      await apiRequest(`/checkouts/${id}/checkin`, { 
        method: 'POST', 
        body: { condition: 'Good' } 
      });
      setShowCheckin(false);
      loadAsset();
    } catch (err) {
      alert('Checkin failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      await apiRequest(`/transfers/asset/${id}`, { 
        method: 'POST', 
        body: { toLocationId: targetLocationId } 
      });
      setShowTransfer(false);
      loadAsset();
    } catch (err) {
      alert('Transfer failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <main className="p-4 md:p-8 max-w-4xl mx-auto"><p className="text-gray-500 font-medium">Loading asset details...</p></main>;
  if (!asset) return <main className="p-4 md:p-8 max-w-4xl mx-auto"><p className="text-red-500 font-medium">Asset not found</p></main>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <button 
        onClick={() => navigate('/assets')} 
        className="mb-6 neu-button px-4 py-2 rounded-xl text-blue-600 font-medium text-sm flex items-center gap-2"
      >
        &larr; Back to Assets
      </button>

      <div className="neu-flat p-8 rounded-2xl">
        <h1 className="text-2xl font-bold text-gray-700 mb-2 truncate">
          <span className="text-blue-600 mr-2">{asset.displayCode}</span> 
          {asset.assetDefinition?.name}
        </h1>
        
        <div className="flex flex-wrap gap-6 md:gap-10 my-8">
          <div className="neu-inset p-4 rounded-xl flex-1 min-w-[150px]">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Status</p>
            <p className={`font-semibold capitalize ${
              asset.status === 'available' ? 'text-emerald-600' : 
              asset.status === 'issued' ? 'text-blue-600' : 'text-gray-700'
            }`}>{asset.status.replace('_', ' ')}</p>
          </div>
          <div className="neu-inset p-4 rounded-xl flex-1 min-w-[150px]">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Current Location</p>
            <p className="font-semibold text-gray-700 truncate">{asset.currentLocation?.name || 'Unknown'}</p>
          </div>
          {asset.currentHolder && (
            <div className="neu-inset p-4 rounded-xl flex-1 min-w-[150px]">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Current Holder</p>
              <p className="font-semibold text-blue-600 truncate">{asset.currentHolder.displayName}</p>
            </div>
          )}
        </div>

        <div className="flex gap-4 border-t border-gray-200/50 pt-6">
          {asset.status === 'available' && (
            <button onClick={() => setShowCheckout(true)} className="neu-button px-6 py-2.5 rounded-xl font-medium text-emerald-600 flex-1 md:flex-none">
              Check Out
            </button>
          )}
          {asset.status === 'issued' && (
            <button onClick={() => setShowCheckin(true)} className="neu-button px-6 py-2.5 rounded-xl font-medium text-amber-600 flex-1 md:flex-none">
              Check In
            </button>
          )}
          <button onClick={() => setShowTransfer(true)} className="neu-button px-6 py-2.5 rounded-xl font-medium text-blue-600 flex-1 md:flex-none">
            Transfer Location
          </button>
        </div>
      </div>

      {/* Check Out Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md neu-flat rounded-2xl p-6 md:p-8 space-y-5">
            <h2 className="text-xl font-bold text-gray-700 border-b border-gray-200/50 pb-3">Check Out Asset</h2>
            <form onSubmit={handleCheckout} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">User ID to hold asset:</label>
                <input 
                  required type="text" 
                  value={targetUserId} 
                  onChange={e => setTargetUserId(e.target.value)} 
                  className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700" 
                />
              </div>
              <div className="flex gap-4 justify-end pt-4 border-t border-gray-200/50">
                <button type="button" onClick={() => setShowCheckout(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 neu-button rounded-xl">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2.5 text-sm font-medium text-emerald-600 neu-button rounded-xl disabled:opacity-50">
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check In Modal */}
      {showCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md neu-flat rounded-2xl p-6 md:p-8 space-y-5">
            <h2 className="text-xl font-bold text-gray-700 border-b border-gray-200/50 pb-3">Check In Asset</h2>
            <p className="text-gray-600 font-medium">Are you sure you want to return this asset to available inventory?</p>
            <div className="flex gap-4 justify-end pt-4 border-t border-gray-200/50">
              <button type="button" onClick={() => setShowCheckin(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 neu-button rounded-xl">Cancel</button>
              <button onClick={handleCheckin} disabled={actionLoading} className="px-5 py-2.5 text-sm font-medium text-blue-600 neu-button rounded-xl disabled:opacity-50">
                {actionLoading ? 'Processing...' : 'Check In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md neu-flat rounded-2xl p-6 md:p-8 space-y-5">
            <h2 className="text-xl font-bold text-gray-700 border-b border-gray-200/50 pb-3">Transfer Location</h2>
            <form onSubmit={handleTransfer} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Destination Location ID:</label>
                <input 
                  required type="text" 
                  value={targetLocationId} 
                  onChange={e => setTargetLocationId(e.target.value)} 
                  className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700" 
                />
              </div>
              <div className="flex gap-4 justify-end pt-4 border-t border-gray-200/50">
                <button type="button" onClick={() => setShowTransfer(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 neu-button rounded-xl">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2.5 text-sm font-medium text-blue-600 neu-button rounded-xl disabled:opacity-50">
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
