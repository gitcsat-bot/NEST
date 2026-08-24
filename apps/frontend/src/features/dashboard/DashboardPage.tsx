import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';

export function DashboardPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const data = await apiRequest<any>('/dashboard', { method: 'GET' });
        setMetrics(data);
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  async function handleLogout() {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      navigate('/login', { replace: true });
    }
  }

  if (loading) {
    return <main className="dashboard-container"><p>Loading dashboard...</p></main>;
  }

  return (
    <main className="dashboard-container" style={{ padding: '2rem', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Welcome, {user?.display_name}</h1>
        <button
          type="button"
          onClick={handleLogout}
          style={{ background: 'var(--nest-color-accent)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', border: 'none' }}
        >
          Sign out
        </button>
      </header>

      {user?.pending_role && (
        <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '4px', marginBottom: '2rem', border: '1px solid #ffeeba' }}>
          <strong>Notice:</strong> You have a pending request for the <strong>{user.pending_role}</strong> role. An administrator will review your request shortly.
        </div>
      )}

      {metrics?.role === 'admin' || metrics?.role === 'stores_manager' ? (
        <AdminDashboard metrics={metrics} />
      ) : metrics?.role === 'student' || metrics?.role === 'contributor' ? (
        <StudentDashboard metrics={metrics} user={user} setUser={setUser} />
      ) : (
        <ViewerDashboard metrics={metrics} user={user} setUser={setUser} />
      )}
    </main>
  );
}

async function requestAdminRole(setUser: any) {
  try {
    const res = await apiRequest<any>('/users/me/request-role', { method: 'POST', body: { role: 'admin' } });
    setUser(res);
  } catch (err) {
    console.error('Failed to request role', err);
  }
}

function AdminDashboard({ metrics }: { metrics: any }) {
  return (
    <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <Widget title="Users Overview">
        <p><strong>Total Users:</strong> {metrics.users?.total}</p>
        <p><strong>Active:</strong> {metrics.users?.active}</p>
        <p><strong>Inactive:</strong> {metrics.users?.inactive}</p>
      </Widget>

      <Widget title="Low Inventory Items">
        {metrics.lowInventoryItems?.length === 0 ? (
          <p>All items are sufficiently stocked.</p>
        ) : (
          <ul style={{ paddingLeft: '1rem' }}>
            {metrics.lowInventoryItems?.map((item: any) => (
              <li key={item.id}>
                {item.name} ({item.location_name}) - {item.quantity_on_hand} left (Threshold: {item.reorder_threshold})
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="Locations">
        <ul style={{ paddingLeft: '1rem' }}>
          {metrics.locations?.map((loc: any) => (
            <li key={loc.id}>{loc.name}</li>
          ))}
        </ul>
      </Widget>
    </div>
  );
}

function StudentDashboard({ metrics, user, setUser }: { metrics: any, user: any, setUser: any }) {
  return (
    <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <Widget title="My Requests (Reservations)">
        <p><strong>Sent:</strong> {metrics.requests?.sent}</p>
        <p><strong>Approved:</strong> {metrics.requests?.approved}</p>
        <p><strong>Rejected:</strong> {metrics.requests?.rejected}</p>
      </Widget>

      <Widget title="Item Status Overview">
        <ul style={{ paddingLeft: '1rem' }}>
          {metrics.itemsStatus?.map((status: any) => (
            <li key={status.status}>{status.status}: {status.count}</li>
          ))}
        </ul>
      </Widget>

      <Widget title="Locations">
        <ul style={{ paddingLeft: '1rem' }}>
          {metrics.locations?.map((loc: any) => (
            <li key={loc.id}>{loc.name}</li>
          ))}
        </ul>
      </Widget>

      <Widget title="Admin Contacts">
        <ul style={{ paddingLeft: '1rem', marginBottom: '1rem' }}>
          {metrics.adminContacts?.map((admin: any) => (
            <li key={admin.email}>{admin.displayName} - <a href={`mailto:${admin.email}`}>{admin.email}</a></li>
          ))}
        </ul>
        {!user?.pending_role && (
          <button 
            onClick={() => requestAdminRole(setUser)}
            style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
          >
            Request Admin Access
          </button>
        )}
      </Widget>
    </div>
  );
}

function ViewerDashboard({ metrics, user, setUser }: { metrics: any, user: any, setUser: any }) {
  return (
    <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <Widget title="Locations">
        <ul style={{ paddingLeft: '1rem' }}>
          {metrics.locations?.map((loc: any) => (
            <li key={loc.id}>{loc.name}</li>
          ))}
        </ul>
      </Widget>

      <Widget title="Admin Contacts">
        <ul style={{ paddingLeft: '1rem', marginBottom: '1rem' }}>
          {metrics.adminContacts?.map((admin: any) => (
            <li key={admin.email}>{admin.displayName} - <a href={`mailto:${admin.email}`}>{admin.email}</a></li>
          ))}
        </ul>
        {!user?.pending_role && (
          <button 
            onClick={() => requestAdminRole(setUser)}
            style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
          >
            Request Admin Access
          </button>
        )}
      </Widget>
    </div>
  );
}

function Widget({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
        {title}
      </h2>
      <div>{children}</div>
    </div>
  );
}
