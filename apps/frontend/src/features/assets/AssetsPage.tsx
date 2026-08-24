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
    <main style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Asset Tracking</h1>
      </header>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input 
          type="text" 
          placeholder="Search by ID, Serial, or Name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--nest-color-accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Search</button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>Display Code</th>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>Location</th>
              <th style={{ padding: '1rem' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(asset => (
              <tr key={asset.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '1rem' }}>{asset.displayCode}</td>
                <td style={{ padding: '1rem' }}>{asset.assetDefinition?.name}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '12px', 
                    fontSize: '0.875rem',
                    backgroundColor: asset.status === 'available' ? '#dcfce7' : '#fee2e2',
                    color: asset.status === 'available' ? '#166534' : '#991b1b'
                  }}>
                    {asset.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>{asset.currentLocation?.name || 'Unknown'}</td>
                <td style={{ padding: '1rem' }}>
                  <button 
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    style={{ background: 'transparent', color: 'var(--nest-color-accent)', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>No assets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}
