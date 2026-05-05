import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';

interface Site { id: string; name: string; code: string }
interface Asset { id: string; name: string; plantId: string | null; site: { id: string } }

interface AuditItem {
  id: string;
  type: 'INSPECTION' | 'WORK_ORDER' | 'BREAKDOWN' | 'PPM';
  title: string;
  assetName: string | null;
  siteName: string;
  siteCode: string;
  dueDate: string | null;
  completedAt: string | null;
  status: string;
  daysToClose: number | null;
  isOverdue: boolean;
  priority?: string;
  manHours?: number | null;
  partsCost?: number | null;
}

interface AuditSummary {
  total: number;
  closed: number;
  openOrOverdue: number;
  avgDaysToClose: number | null;
  pctClosed: number | null;
}

interface AuditResponse {
  items: AuditItem[];
  total: number;
  summary: AuditSummary;
  period: { from: string; to: string };
}

const TYPE_COLOURS: Record<string, string> = {
  INSPECTION: 'bg-blue-100 text-blue-800',
  WORK_ORDER: 'bg-purple-100 text-purple-800',
  BREAKDOWN: 'bg-red-100 text-red-800',
  PPM: 'bg-green-100 text-green-800',
};

const STATUS_COLOURS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  VERIFIED: 'bg-green-100 text-green-800',
  PASS: 'bg-green-100 text-green-800',
  RESOLVED: 'bg-green-100 text-green-800',
  FAIL: 'bg-red-100 text-red-800',
  MONITOR: 'bg-amber-100 text-amber-800',
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  WAITING_PARTS: 'bg-amber-100 text-amber-800',
  ABANDONED: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLOURS: Record<string, string> = {
  CRITICAL: 'text-red-700',
  HIGH: 'text-orange-600',
  MEDIUM: 'text-amber-600',
  LOW: 'text-gray-500',
};

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
];

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysColour(days: number | null, isOverdue: boolean) {
  if (isOverdue) return 'text-red-600 font-semibold';
  if (days === null) return 'text-gray-400';
  if (days <= 1) return 'text-green-700';
  if (days <= 7) return 'text-amber-600';
  return 'text-red-600';
}

export default function DashboardPage() {
  const { user } = useAuth();

  const today = new Date();
  const [fromDate, setFromDate] = useState(toInputDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)));
  const [toDate, setToDate] = useState(toInputDate(today));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['INSPECTION', 'WORK_ORDER', 'BREAKDOWN', 'PPM']);
  const [siteId, setSiteId] = useState(user?.siteId || '');
  const [assetId, setAssetId] = useState('');
  const [sortField, setSortField] = useState<'dueDate' | 'daysToClose' | 'type' | 'status'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  });

  const { data: assets } = useQuery<{ assets: Asset[] }>({
    queryKey: ['assets', siteId],
    queryFn: () => api.get(`/assets${siteId ? `?siteId=${siteId}` : ''}`).then(r => r.data),
  });

  const queryParams = new URLSearchParams({
    type: selectedTypes.join(','),
    from: new Date(fromDate).toISOString(),
    to: new Date(toDate + 'T23:59:59').toISOString(),
    ...(siteId && { siteId }),
    ...(assetId && { assetId }),
  });

  const { data: auditData, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit', selectedTypes.join(','), fromDate, toDate, siteId, assetId],
    queryFn: () => api.get(`/reports/audit?${queryParams}`).then(r => r.data),
  });

  const sortedItems = useMemo(() => {
    if (!auditData?.items) return [];
    return [...auditData.items].sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      if (sortField === 'dueDate') {
        va = a.dueDate || a.completedAt || '';
        vb = b.dueDate || b.completedAt || '';
      } else if (sortField === 'daysToClose') {
        va = a.daysToClose ?? (a.isOverdue ? 9999 : -1);
        vb = b.daysToClose ?? (b.isOverdue ? 9999 : -1);
      } else if (sortField === 'type') {
        va = a.type;
        vb = b.type;
      } else if (sortField === 'status') {
        va = a.status;
        vb = b.status;
      }
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [auditData?.items, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleType = (t: string) => {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const applyPreset = (days: number) => {
    const d = new Date();
    setToDate(toInputDate(d));
    setFromDate(toInputDate(new Date(d.getTime() - days * 24 * 60 * 60 * 1000)));
  };

  const s = auditData?.summary;

  const typeBreakdown = useMemo(() => {
    if (!auditData?.items) return {};
    return auditData.items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [auditData?.items]);

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Audit &amp; Compliance Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Inspections, PPM, work orders and breakdowns — when due vs. when closed
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#297e49]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#297e49]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Site</label>
              <select value={siteId} onChange={e => { setSiteId(e.target.value); setAssetId(''); }}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#297e49]">
                <option value="">All sites</option>
                {sites?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Asset</label>
              <select value={assetId} onChange={e => setAssetId(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#297e49]">
                <option value="">All assets</option>
                {assets?.assets?.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.plantId ? ` (${a.plantId})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map(p => (
              <button key={p.days} onClick={() => applyPreset(p.days)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['INSPECTION', 'WORK_ORDER', 'BREAKDOWN', 'PPM'] as const).map(t => (
              <button key={t} onClick={() => toggleType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                  selectedTypes.includes(t)
                    ? `${TYPE_COLOURS[t]} border-transparent`
                    : 'bg-white border-gray-200 text-gray-400'
                }`}>
                {t.replace('_', ' ')} {typeBreakdown[t] ? `(${typeBreakdown[t]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-[#1a1a1a]">{s.total}</div>
              <div className="text-xs text-gray-500 mt-1">Total Items</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold ${s.pctClosed != null && s.pctClosed >= 80 ? 'text-[#297e49]' : s.pctClosed != null && s.pctClosed >= 60 ? 'text-[#f59e0b]' : 'text-[#dc2d2f]'}`}>
                {s.pctClosed != null ? `${s.pctClosed}%` : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Closed / Completed</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold ${s.openOrOverdue > 0 ? 'text-[#dc2d2f]' : 'text-[#297e49]'}`}>
                {s.openOrOverdue}
              </div>
              <div className="text-xs text-gray-500 mt-1">Open / Overdue</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold ${s.avgDaysToClose != null && s.avgDaysToClose <= 1 ? 'text-[#297e49]' : s.avgDaysToClose != null && s.avgDaysToClose <= 7 ? 'text-[#f59e0b]' : 'text-[#dc2d2f]'}`}>
                {s.avgDaysToClose != null ? `${s.avgDaysToClose}d` : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Avg. Days to Close</div>
            </div>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium">No records found for this period</p>
            <p className="text-sm mt-1">Try adjusting the filters or date range</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-[#e0e0e0]">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                      <button onClick={() => toggleSort('type')} className="flex items-center gap-1 hover:text-gray-800">
                        Type {sortField === 'type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Title / Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Asset</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Site</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                      <button onClick={() => toggleSort('dueDate')} className="flex items-center gap-1 hover:text-gray-800">
                        Due / Started {sortField === 'dueDate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Closed / Completed</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                      <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-gray-800">
                        Status {sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">
                      <button onClick={() => toggleSort('daysToClose')} className="flex items-center gap-1 hover:text-gray-800">
                        Days to Close {sortField === 'daysToClose' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {sortedItems.map(item => (
                    <tr key={`${item.type}-${item.id}`} className={`hover:bg-gray-50 ${item.isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLOURS[item.type]}`}>
                          {item.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-xs font-medium text-[#1a1a1a] truncate">{item.title}</p>
                        {item.priority && (
                          <span className={`text-xs font-medium ${PRIORITY_COLOURS[item.priority] || ''}`}>{item.priority}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{item.assetName || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{item.siteCode}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {item.dueDate
                          ? new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {item.completedAt
                          ? new Date(item.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : <span className="text-red-500 font-medium">Not closed</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {item.isOverdue ? (
                          <span className="text-red-600 font-semibold">
                            Open {item.dueDate ? Math.floor((Date.now() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24)) + 'd' : ''}
                          </span>
                        ) : item.daysToClose != null ? (
                          <span className={daysColour(item.daysToClose, false)}>
                            {item.daysToClose < 1 ? '<1d' : `${item.daysToClose}d`}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-[#f0f0f0] text-xs text-gray-400">
                {sortedItems.length} records · Period: {new Date(fromDate).toLocaleDateString('en-GB')} – {new Date(toDate).toLocaleDateString('en-GB')}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {sortedItems.map(item => (
                <div key={`${item.type}-${item.id}`}
                  className={`bg-white border rounded-xl p-4 ${item.isOverdue ? 'border-red-200' : 'border-[#e0e0e0]'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${TYPE_COLOURS[item.type]}`}>
                      {item.type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLOURS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#1a1a1a] mb-1">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.assetName || 'No asset'} · {item.siteCode}</p>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-gray-400">
                      {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      {item.completedAt && ` → ${new Date(item.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </span>
                    {item.isOverdue ? (
                      <span className="text-red-600 font-semibold">Open</span>
                    ) : item.daysToClose != null ? (
                      <span className={daysColour(item.daysToClose, false)}>
                        {item.daysToClose < 1 ? '<1 day' : `${item.daysToClose} days`}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
