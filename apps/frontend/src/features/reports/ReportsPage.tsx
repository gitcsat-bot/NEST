import { useState, useEffect } from 'react';
import { SecurityReportDto, LoginReportDto, InventoryReportDto } from '@nest/shared-types';
import { fetchSecurityReport, fetchLoginReport, fetchInventoryReport } from '../../api-client/reports';

type Tab = 'security' | 'logins' | 'inventory';

// Admin-only reports (Implementation Plan checklist item 5). See the doc
// comment at the top of report.ts (shared-types) for scope notes.
export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('security');
  const [security, setSecurity] = useState<SecurityReportDto | null>(null);
  const [logins, setLogins] = useState<LoginReportDto | null>(null);
  const [inventory, setInventory] = useState<InventoryReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchSecurityReport(), fetchLoginReport(), fetchInventoryReport()])
      .then(([s, l, i]) => {
        setSecurity(s);
        setLogins(l);
        setInventory(i);
      })
      .catch(() => setError('Failed to load reports.'))
      .finally(() => setLoading(false));
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'security', label: 'Security' },
    { key: 'logins', label: 'Logins' },
    { key: 'inventory', label: 'Inventory' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Reports</h1>
        <p className="text-sm font-medium text-gray-600">System overview and admin metrics.</p>
      </div>

      <div className="flex gap-4 mb-8">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t.key ? 'neu-button text-blue-600' : 'text-gray-500 hover:bg-gray-200/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-8 rounded-xl p-4 text-sm neu-inset text-red-600 font-medium"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm font-medium">Loading…</p>
      ) : (
        <div className="neu-flat rounded-2xl p-6 md:p-8">
          {tab === 'security' && security && <SecurityReportView report={security} />}
          {tab === 'logins' && logins && <LoginReportView report={logins} />}
          {tab === 'inventory' && inventory && <InventoryReportView report={inventory} />}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="neu-inset rounded-xl p-4 flex flex-col justify-center items-center text-center">
      <div className="text-3xl font-bold text-gray-700">{value}</div>
      <div className="text-sm font-medium text-gray-500 mt-2">{label}</div>
    </div>
  );
}

function SecurityReportView({ report }: { report: SecurityReportDto }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6 border-b border-gray-200/50 pb-4">
        <h2 className="text-lg font-bold text-gray-700">Security Overview</h2>
        <span className="neu-inset px-3 py-1 rounded-lg text-sm font-medium text-gray-500">Last {report.window_days} days</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Failed logins" value={report.failed_login_count} />
        <StatCard label="Account lockouts" value={report.account_locked_count} />
        <StatCard label="2FA failures" value={report.two_factor_failure_count} />
        <StatCard label="Role changes" value={report.role_change_count} />
        <StatCard label="Deactivations" value={report.deactivation_count} />
      </div>
      
      <h3 className="text-md font-bold text-gray-700 mb-4">Recent Events</h3>
      <EventTable events={report.recent_events} />
    </div>
  );
}

function LoginReportView({ report }: { report: LoginReportDto }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6 border-b border-gray-200/50 pb-4">
        <h2 className="text-lg font-bold text-gray-700">Login Activity</h2>
        <span className="neu-inset px-3 py-1 rounded-lg text-sm font-medium text-gray-500">Last {report.window_days} days</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Successful logins" value={report.successful_login_count} />
        <StatCard label="Failed logins" value={report.failed_login_count} />
        <StatCard label="Unique users" value={report.unique_users_logged_in} />
      </div>
      
      <h3 className="text-md font-bold text-gray-700 mb-4">Recent Events</h3>
      <EventTable events={report.recent_events} />
    </div>
  );
}

function InventoryReportView({ report }: { report: InventoryReportDto }) {
  return (
    <div>
      <div className="mb-6 border-b border-gray-200/50 pb-4">
        <h2 className="text-lg font-bold text-gray-700">Inventory Overview</h2>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total materials" value={report.total_materials} />
        <StatCard label="Pending requests" value={report.pending_inventory_requests} />
        <StatCard label="Low stock" value={report.low_stock_materials.length} />
      </div>

      <div className="mb-8">
        <h3 className="text-md font-bold text-gray-700 mb-4">Materials by Status</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(report.materials_by_status).map(([status, count]) => (
            <div key={status} className="neu-inset px-4 py-2 rounded-xl flex gap-3 items-center">
              <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">{status}</span>
              <span className="text-lg font-bold text-blue-600">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-md font-bold text-gray-700 mb-4">Low Stock Alerts</h3>
        {report.low_stock_materials.length === 0 ? (
          <p className="text-gray-500 text-sm font-medium">Nothing below its reorder threshold.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.low_stock_materials.map((m) => (
              <div key={m.id} className="neu-inset rounded-xl p-4 flex justify-between items-center">
                <span className="font-bold text-gray-700">{m.asset_definition_name}</span>
                <div className="flex flex-col items-end">
                  <span className="text-red-600 font-bold text-lg">{m.quantity_on_hand}</span>
                  <span className="text-xs font-medium text-gray-500">Reorder at {m.reorder_threshold}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventTable({ events }: { events: SecurityReportDto['recent_events'] }) {
  if (events.length === 0) {
    return <p className="text-gray-500 text-sm font-medium">No events in this window.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3">
      {events.map((e) => (
        <div key={e.id} className="neu-inset rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono font-bold text-sm text-blue-600 uppercase">{e.action}</span>
            <span className="text-sm font-medium text-gray-600">{e.actor_display_name ?? '—'}</span>
          </div>
          <div className="flex flex-col sm:items-end gap-1 text-sm">
            <span className="font-medium text-gray-700">{new Date(e.created_at).toLocaleString()}</span>
            <span className="font-mono text-gray-500 text-xs">{e.ip_address ?? '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
