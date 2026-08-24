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

  if (loading) return <main style={{ padding: '2rem' }}><p>Loading...</p></main>;
  if (!asset) return <main style={{ padding: '2rem' }}><p>Asset not found</p></main>;

  return (
    <main style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <button onClick={() => navigate('/assets')} style={{ marginBottom: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nest-color-accent)', textDecoration: 'underline' }}>
        &larr; Back to Assets
      </button>

      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>{asset.displayCode} - {asset.assetDefinition?.name}</h1>
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>Status</p>
            <p style={{ fontWeight: 500 }}>{asset.status}</p>
          </div>
          <div>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>Current Location</p>
            <p style={{ fontWeight: 500 }}>{asset.currentLocation?.name || 'Unknown'}</p>
          </div>
          {asset.currentHolder && (
            <div>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Current Holder</p>
              <p style={{ fontWeight: 500 }}>{asset.currentHolder.displayName}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
          {asset.status === 'available' && (
            <button onClick={() => setShowCheckout(true)} style={btnStyle}>Check Out</button>
          )}
          {asset.status === 'issued' && (
            <button onClick={() => setShowCheckin(true)} style={btnStyle}>Check In</button>
          )}
          <button onClick={() => setShowTransfer(true)} style={{ ...btnStyle, backgroundColor: '#4b5563' }}>Transfer</button>
        </div>
      </div>

      {/* Check Out Modal */}
      {showCheckout && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2>Check Out Asset</h2>
            <form onSubmit={handleCheckout}>
              <div style={{ margin: '1rem 0' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>User ID to hold asset:</label>
                <input required type="text" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCheckout(false)} style={btnOutlineStyle}>Cancel</button>
                <button type="submit" disabled={actionLoading} style={btnStyle}>{actionLoading ? 'Processing...' : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check In Modal */}
      {showCheckin && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2>Check In Asset</h2>
            <p style={{ margin: '1rem 0' }}>Are you sure you want to return this asset to available inventory?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCheckin(false)} style={btnOutlineStyle}>Cancel</button>
              <button onClick={handleCheckin} disabled={actionLoading} style={btnStyle}>{actionLoading ? 'Processing...' : 'Confirm Check In'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2>Transfer Asset</h2>
            <form onSubmit={handleTransfer}>
              <div style={{ margin: '1rem 0' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Destination Location ID:</label>
                <input required type="text" value={targetLocationId} onChange={e => setTargetLocationId(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowTransfer(false)} style={btnOutlineStyle}>Cancel</button>
                <button type="submit" disabled={actionLoading} style={btnStyle}>{actionLoading ? 'Processing...' : 'Confirm Transfer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

const btnStyle = { padding: '0.5rem 1rem', background: 'var(--nest-color-accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 };
const btnOutlineStyle = { padding: '0.5rem 1rem', background: 'transparent', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 };
const inputStyle = { width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' };
const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContent: React.CSSProperties = { backgroundColor: 'white', padding: '2rem', borderRadius: '8px', minWidth: '400px' };
