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
    return <main className="p-4 md:p-8 max-w-7xl mx-auto"><p className="text-gray-500 font-medium">Loading dashboard...</p></main>;
  }

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-700">Welcome, {user?.display_name}</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="neu-button px-6 py-2.5 rounded-xl text-sm font-bold text-red-600 transition-all"
        >
          Sign out
        </button>
      </header>

      {user?.pending_role && (
        <div className="neu-inset text-yellow-600 p-4 rounded-xl mb-8 font-medium">
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

async function requestRole(role: string, setUser: any) {
  try {
    const res = await apiRequest<any>('/users/me/request-role', { method: 'POST', body: { role } });
    setUser(res);
  } catch (err) {
    console.error('Failed to request role', err);
  }
}

function AdminDashboard({ metrics }: { metrics: any }) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Widget title="Users Overview">
        <div className="space-y-2">
          <p className="flex justify-between"><strong className="text-gray-600">Total Users:</strong> <span className="font-semibold text-gray-800">{metrics.users?.total}</span></p>
          <p className="flex justify-between"><strong className="text-gray-600">Active:</strong> <span className="font-semibold text-green-600">{metrics.users?.active}</span></p>
          <p className="flex justify-between"><strong className="text-gray-600">Inactive:</strong> <span className="font-semibold text-red-600">{metrics.users?.inactive}</span></p>
        </div>
      </Widget>

      <Widget title="Low Inventory Items">
        {metrics.lowInventoryItems?.length === 0 ? (
          <p className="text-gray-500 italic">All items are sufficiently stocked.</p>
        ) : (
          <ul className="space-y-3">
            {metrics.lowInventoryItems?.map((item: any) => (
              <li key={item.id} className="text-sm">
                <span className="font-semibold text-gray-700">{item.name}</span> <span className="text-gray-500">({item.location_name})</span>
                <br />
                <span className="text-red-500">{item.quantity_on_hand} left</span> <span className="text-gray-400">(Threshold: {item.reorder_threshold})</span>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="Locations">
        <ul className="space-y-2">
          {metrics.locations?.map((loc: any) => (
            <li key={loc.id} className="text-gray-700 neu-inset px-3 py-1.5 rounded-lg text-sm font-medium">{loc.name}</li>
          ))}
        </ul>
      </Widget>
    </div>
  );
}

function StudentDashboard({ metrics, user, setUser }: { metrics: any, user: any, setUser: any }) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Widget title="My Requests (Reservations)">
        <div className="space-y-2">
          <p className="flex justify-between"><strong className="text-gray-600">Sent:</strong> <span className="font-semibold text-gray-800">{metrics.requests?.sent}</span></p>
          <p className="flex justify-between"><strong className="text-gray-600">Approved:</strong> <span className="font-semibold text-green-600">{metrics.requests?.approved}</span></p>
          <p className="flex justify-between"><strong className="text-gray-600">Rejected:</strong> <span className="font-semibold text-red-600">{metrics.requests?.rejected}</span></p>
        </div>
      </Widget>

      <Widget title="Item Status Overview">
        <ul className="space-y-2">
          {metrics.itemsStatus?.map((status: any) => (
            <li key={status.status} className="flex justify-between">
              <span className="text-gray-600 capitalize">{status.status}</span> 
              <span className="font-semibold text-gray-800">{status.count}</span>
            </li>
          ))}
        </ul>
      </Widget>

      <Widget title="Locations">
        <ul className="space-y-2">
          {metrics.locations?.map((loc: any) => (
            <li key={loc.id} className="text-gray-700 neu-inset px-3 py-1.5 rounded-lg text-sm font-medium">{loc.name}</li>
          ))}
        </ul>
      </Widget>

      <Widget title="Admin Contacts">
        <ul className="space-y-3 mb-6">
          {metrics.adminContacts?.map((admin: any) => (
            <li key={admin.email} className="text-sm">
              <span className="font-semibold text-gray-700 block">{admin.displayName}</span>
              <a href={`mailto:${admin.email}`} className="text-blue-500 hover:underline">{admin.email}</a>
            </li>
          ))}
        </ul>
        {!user?.pending_role && (
          <button 
            onClick={() => requestRole('contributor', setUser)}
            className="neu-button py-3 w-full rounded-xl text-blue-600 font-bold transition-all"
          >
            Request Contributor Role
          </button>
        )}
      </Widget>
    </div>
  );
}

function ViewerDashboard({ metrics, user, setUser }: { metrics: any, user: any, setUser: any }) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Widget title="Locations">
        <ul className="space-y-2">
          {metrics.locations?.map((loc: any) => (
            <li key={loc.id} className="text-gray-700 neu-inset px-3 py-1.5 rounded-lg text-sm font-medium">{loc.name}</li>
          ))}
        </ul>
      </Widget>

      <Widget title="Admin Contacts">
        <ul className="space-y-3 mb-6">
          {metrics.adminContacts?.map((admin: any) => (
            <li key={admin.email} className="text-sm">
              <span className="font-semibold text-gray-700 block">{admin.displayName}</span>
              <a href={`mailto:${admin.email}`} className="text-blue-500 hover:underline">{admin.email}</a>
            </li>
          ))}
        </ul>
        {!user?.pending_role && (
          <button 
            onClick={() => requestRole('student', setUser)}
            className="neu-button py-3 w-full rounded-xl text-blue-600 font-bold transition-all"
          >
            Request Student Role
          </button>
        )}
      </Widget>
    </div>
  );
}

function Widget({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="neu-flat p-6 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200/50">
        {title}
      </h2>
      <div className="flex-1">{children}</div>
    </div>
  );
}
