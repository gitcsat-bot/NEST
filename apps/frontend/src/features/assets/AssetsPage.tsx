import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api-client/client';

export function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadAssets() {
      try {
        const data = await apiRequest<any[]>('/assets', { method: 'GET' });
        setAssets(data);
      } catch (err) {
        console.error('Failed to load assets', err);
      } finally {
        setLoading(false);
      }
    }
    loadAssets();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = searchQuery ? `/search/assets?q=${encodeURIComponent(searchQuery)}` : '/assets';
      const data = await apiRequest<any[]>(endpoint, { method: 'GET' });
      setAssets(data);
    } catch (err) {
      console.error('Failed to search assets', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-700">Asset Tracking</h1>
      </header>

      <form onSubmit={handleSearch} className="flex gap-4 mb-8">
        <input 
          type="text" 
          placeholder="Search by ID, Serial, or Name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700"
        />
        <button type="submit" className="neu-button px-6 py-3 rounded-xl font-medium text-blue-600">Search</button>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : assets.length === 0 ? (
        <p className="text-gray-500 text-sm">No assets found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {assets.map(asset => (
            <div key={asset.id} className="neu-flat rounded-xl p-5 flex flex-col justify-between cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-700 truncate pr-2" title={asset.assetDefinition?.name}>{asset.assetDefinition?.name}</h3>
                  <span className="text-xs font-mono neu-inset px-2 py-1 rounded text-blue-700 font-bold flex-shrink-0">
                    {asset.displayCode}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold neu-inset uppercase tracking-wider ${
                      asset.status === 'available' ? 'text-emerald-600' : 
                      asset.status === 'checked_out' ? 'text-amber-600' :
                      asset.status === 'maintenance' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {asset.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Location</span>
                    <span className="text-gray-700 font-medium truncate ml-2" title={asset.currentLocation?.name || 'Unknown'}>
                      {asset.currentLocation?.name || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200/50 mt-auto text-right">
                <span className="text-sm text-blue-600 font-medium">View Details →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
