import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';
import ScanAssetModal from '@/components/ScanAssetModal';

interface DashboardData {
  dueTodayCount: number;
  overdueCount: number;
  openWorkOrdersCount: number;
  openWorkOrders: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    asset: { name: string } | null;
    site: { name: string; code: string };
    createdAt: string;
  }>;
  ppmDueThisWeekCount: number;
  recentInspections: Array<{
    id: string;
    startedAt: string;
    status: string;
    overallResult: string | null;
    template: { name: string };
    asset: { name: string } | null;
  }>;
}

interface ActiveBreakdown {
  id: string;
  startedAt: string;
  description: string;
  asset: { name: string } | null;
  site: { code: string };
}

interface OverdueWO {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string;
  site: { code: string };
  asset: { name: string } | null;
}

interface OverdueSchedule {
  id: string;
  nextDueAt: string;
  siteId: string;
  frequency: string;
  template: { id: string; name: string; type: string };
}

function useDashboard() {
  const { user } = useAuth();
  const siteId = user?.siteId;

  return useQuery<DashboardData>({
    queryKey: ['dashboard', siteId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const params = siteId ? `?siteId=${siteId}` : '';

      const [woRes, inspRes, ppmRes] = await Promise.all([
        api.get(`/work-orders${params}&status=OPEN&limit=10`),
        api.get(`/inspections${params}&limit=5`),
        api.get(`/ppm${params}`),
      ]);

      const workOrders = woRes.data.workOrders;
      const inspections = inspRes.data.inspections;
      const ppms = ppmRes.data;

      const ppmDueThisWeek = ppms.filter((p: { nextDueAt: string }) =>
        new Date(p.nextDueAt) <= endOfWeek
      ).length;

      return {
        dueTodayCount: 0,
        overdueCount: 0,
        openWorkOrdersCount: woRes.data.total,
        openWorkOrders: workOrders,
        ppmDueThisWeekCount: ppmDueThisWeek,
        recentInspections: inspections,
      };
    },
  });
}

export default function HomePage() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();
  const [showScan, setShowScan] = useState(false);

  const { data: activeBreakdowns } = useQuery<{ breakdowns: ActiveBreakdown[] }>({
    queryKey: ['breakdowns-active'],
    queryFn: () => api.get('/breakdowns?limit=20').then(r => ({
      breakdowns: r.data.breakdowns.filter((b: ActiveBreakdown & { resolvedAt: string | null }) => !b.resolvedAt)
    })),
  });

  const { data: overdueWOs } = useQuery<OverdueWO[]>({
    queryKey: ['work-orders-overdue'],
    queryFn: () => api.get('/work-orders/overdue').then(r => r.data),
  });

  const { data: overdueSchedules } = useQuery<OverdueSchedule[]>({
    queryKey: ['inspection-schedules-overdue'],
    queryFn: () => api.get('/inspections/schedules/overdue').then(r => r.data),
  });

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-24 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-[#1a1a1a] leading-tight">
              Good {getGreeting()}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">
              {user?.site?.name || 'All Sites'} &middot; {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Quick actions */}
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Actions</h2>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowScan(true)}
                  className="flex flex-col items-center justify-center bg-[#153f26] hover:bg-[#0e2c1a] text-white rounded-xl py-3 gap-1 transition-colors min-h-[72px]"
                >
                  <span className="text-xl">📷</span>
                  <span className="text-xs font-semibold leading-tight text-center">Scan Asset</span>
                </button>
                <ActionButton href="/inspections/start" icon="✓" label="Start Inspection" colour="green" />
                <ActionButton href="/breakdowns/log" icon="⚠" label="Log Breakdown" colour="red" />
                <ActionButton href="/work-orders" icon="🔧" label="Work Orders" colour="blue" />
                <ActionButton href="/admin/ppm" icon="📅" label="PPM Schedule" colour="purple" />
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard
                label="Open Work Orders"
                value={data?.openWorkOrdersCount ?? 0}
                href="/work-orders"
                colour={data?.openWorkOrdersCount ? 'red' : 'green'}
              />
              <StatCard
                label="PPM Due This Week"
                value={data?.ppmDueThisWeekCount ?? 0}
                href="/admin/ppm"
                colour={data?.ppmDueThisWeekCount ? 'amber' : 'green'}
              />
              <StatCard
                label="Overdue Inspections"
                value={overdueSchedules?.length ?? 0}
                href="/inspections/start"
                colour={overdueSchedules?.length ? 'red' : 'green'}
              />
              <StatCard
                label="Active Breakdowns"
                value={activeBreakdowns?.breakdowns.length ?? 0}
                href="/breakdowns"
                colour={activeBreakdowns?.breakdowns.length ? 'red' : 'green'}
              />
            </div>

            {/* Alerts */}
            {overdueWOs && overdueWOs.length > 0 && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-red-600 font-semibold text-xs">⚠ {overdueWOs.length} Overdue Work Order{overdueWOs.length !== 1 ? 's' : ''}</span>
                  <Link to="/work-orders?filter=OVERDUE" className="text-xs text-red-600 font-medium hover:underline">View all</Link>
                </div>
                <div className="space-y-1">
                  {overdueWOs.slice(0, 2).map(wo => (
                    <Link key={wo.id} to={`/work-orders/${wo.id}`} className="flex items-center justify-between text-xs text-red-700 hover:underline">
                      <span className="truncate flex-1">{wo.title}</span>
                      <span className="ml-2 flex-shrink-0">{wo.asset?.name || wo.site.code}</span>
                    </Link>
                  ))}
                  {overdueWOs.length > 2 && <p className="text-xs text-red-400">+{overdueWOs.length - 2} more</p>}
                </div>
              </div>
            )}

            {overdueSchedules && overdueSchedules.length > 0 && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-amber-700 font-semibold text-xs">⏰ {overdueSchedules.length} Overdue Inspection{overdueSchedules.length !== 1 ? 's' : ''}</span>
                  <Link to="/inspections/start" className="text-xs text-amber-700 font-medium hover:underline">Start now</Link>
                </div>
                <div className="space-y-1">
                  {overdueSchedules.slice(0, 2).map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs text-amber-700">
                      <span className="truncate flex-1">{s.template.name}</span>
                      <span className="ml-2 flex-shrink-0 text-amber-500">{new Date(s.nextDueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))}
                  {overdueSchedules.length > 2 && <p className="text-xs text-amber-400">+{overdueSchedules.length - 2} more</p>}
                </div>
              </div>
            )}

            {activeBreakdowns && activeBreakdowns.breakdowns.length > 0 && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-700 font-semibold text-xs">
                    🔴 {activeBreakdowns.breakdowns.length} Active Breakdown{activeBreakdowns.breakdowns.length !== 1 ? 's' : ''}
                  </span>
                  <Link to="/breakdowns" className="text-xs text-red-600 font-medium hover:underline">View all</Link>
                </div>
                <div className="space-y-1.5">
                  {activeBreakdowns.breakdowns.slice(0, 2).map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1a1a1a] truncate">{b.asset?.name || b.site.code}</p>
                        <p className="text-xs text-gray-500 truncate">{b.description}</p>
                      </div>
                      <div className="ml-3 flex-shrink-0 text-right">
                        <p className="text-xs text-red-500">{formatDowntime(b.startedAt)}</p>
                        <Link to="/breakdowns" className="text-xs text-[#297e49] font-semibold">Close</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open work orders */}
            {data?.openWorkOrders && data.openWorkOrders.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Open Work Orders</h2>
                  <Link to="/work-orders" className="text-xs text-[#dc2d2f] font-medium">View all</Link>
                </div>
                <div className="space-y-2">
                  {data.openWorkOrders.map((wo) => (
                    <Link
                      key={wo.id}
                      to={`/work-orders/${wo.id}`}
                      className="block bg-white border border-[#e0e0e0] rounded-xl p-3 hover:border-[#dc2d2f] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1a1a1a] leading-snug truncate">{wo.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {wo.asset?.name || 'No asset'} &middot; {wo.site.code}
                          </p>
                        </div>
                        <StatusBadge status={wo.priority} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent inspections */}
            {data?.recentInspections && data.recentInspections.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent Inspections</h2>
                <div className="space-y-2">
                  {data.recentInspections.map((insp) => (
                    <Link
                      key={insp.id}
                      to={`/inspections/${insp.id}`}
                      className="block bg-white border border-[#e0e0e0] rounded-xl p-3 hover:border-[#297e49] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1a1a1a] truncate">{insp.template.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {insp.asset?.name || 'No asset'} &middot; {new Date(insp.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <StatusBadge status={insp.status} />
                          {insp.overallResult && <StatusBadge status={insp.overallResult} />}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {showScan && <ScanAssetModal onClose={() => setShowScan(false)} />}
    </AppShell>
  );
}

function formatDowntime(startedAt: string) {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m down`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m down` : `${h}h down`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function StatCard({ label, value, href, colour }: { label: string; value: number; href: string; colour: 'red' | 'green' | 'amber' }) {
  const colours = {
    red: 'text-[#dc2d2f]',
    green: 'text-[#297e49]',
    amber: 'text-[#f59e0b]',
  };

  return (
    <Link to={href} className="bg-white border border-[#e0e0e0] rounded-xl p-4 block hover:border-gray-300 transition-colors">
      <div className={`text-3xl font-bold ${colours[colour]} mb-1`}>{value}</div>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
    </Link>
  );
}

function ActionButton({ href, icon, label, colour }: { href: string; icon: string; label: string; colour: string }) {
  const colours: Record<string, string> = {
    green: 'bg-[#297e49] hover:bg-[#1f6338]',
    red: 'bg-[#dc2d2f] hover:bg-[#b52527]',
    blue: 'bg-[#2563eb] hover:bg-[#1d4ed8]',
    purple: 'bg-[#7c3aed] hover:bg-[#6d28d9]',
  };

  return (
    <Link
      to={href}
      className={`flex flex-col items-center justify-center ${colours[colour] || colours.blue} text-white rounded-xl py-3 gap-1 transition-colors min-h-[72px]`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-semibold leading-tight text-center px-1">{label}</span>
    </Link>
  );
}
