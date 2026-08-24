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
    <div>
      <h1 className="text-xl font-semibold mb-6">Reports</h1>

      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded p-3 text-sm"
          style={{ background: '#fef2f2', color: 'var(--nest-color-danger)' }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <>
          {tab === 'security' && security && <SecurityReportView report={security} />}
          {tab === 'logins' && logins && <LoginReportView report={logins} />}
          {tab === 'inventory' && inventory && <InventoryReportView report={inventory} />}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border p-4" style={{ borderRadius: 'var(--nest-radius)' }}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function SecurityReportView({ report }: { report: SecurityReportDto }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Last {report.window_days} days</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Failed logins" value={report.failed_login_count} />
        <StatCard label="Account lockouts" value={report.account_locked_count} />
        <StatCard label="2FA failures" value={report.two_factor_failure_count} />
        <StatCard label="Role changes" value={report.role_change_count} />
        <StatCard label="Deactivations" value={report.deactivation_count} />
      </div>
      <EventTable events={report.recent_events} />
    </div>
  );
}

function LoginReportView({ report }: { report: LoginReportDto }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Last {report.window_days} days</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Successful logins" value={report.successful_login_count} />
        <StatCard label="Failed logins" value={report.failed_login_count} />
        <StatCard label="Unique users" value={report.unique_users_logged_in} />
      </div>
      <EventTable events={report.recent_events} />
    </div>
  );
}

function InventoryReportView({ report }: { report: InventoryReportDto }) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total materials" value={report.total_materials} />
        <StatCard label="Pending requests" value={report.pending_inventory_requests} />
        <StatCard label="Low stock" value={report.low_stock_materials.length} />
      </div>

      <h2 className="text-sm font-semibold mb-2">By status</h2>
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(report.materials_by_status).map(([status, count]) => (
          <span key={status} className="text-xs px-2 py-1 rounded bg-gray-100 font-mono">
            {status}: {count}
          </span>
        ))}
      </div>

      <h2 className="text-sm font-semibold mb-2">Low stock</h2>
      {report.low_stock_materials.length === 0 ? (
        <p className="text-gray-500 text-sm">Nothing below its reorder threshold.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 px-2">Item</th>
              <th className="py-2 px-2">On hand</th>
              <th className="py-2 px-2">Reorder at</th>
            </tr>
          </thead>
          <tbody>
            {report.low_stock_materials.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="py-2 px-2">{m.asset_definition_name}</td>
                <td className="py-2 px-2 font-semibold" style={{ color: 'var(--nest-color-danger)' }}>
                  {m.quantity_on_hand}
                </td>
                <td className="py-2 px-2">{m.reorder_threshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EventTable({ events }: { events: SecurityReportDto['recent_events'] }) {
  if (events.length === 0) {
    return <p className="text-gray-500 text-sm">No events in this window.</p>;
  }
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2 px-2">Action</th>
          <th className="py-2 px-2">Actor</th>
          <th className="py-2 px-2">IP</th>
          <th className="py-2 px-2">When</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e) => (
          <tr key={e.id} className="border-b hover:bg-gray-50">
            <td className="py-2 px-2 font-mono text-xs">{e.action}</td>
            <td className="py-2 px-2">{e.actor_display_name ?? '—'}</td>
            <td className="py-2 px-2 text-gray-500">{e.ip_address ?? '—'}</td>
            <td className="py-2 px-2 text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
