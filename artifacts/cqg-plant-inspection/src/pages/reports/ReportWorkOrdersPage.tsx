import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';

interface WOReport {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    waitingParts: number;
    completed: number;
    verified: number;
    overdue: number;
  };
  bySite: Array<{ siteCode: string; siteName: string; open: number; inProgress: number; completed: number; overdue: number; }>;
  byPriority: Array<{ priority: string; count: number; }>;
}

export default function ReportWorkOrdersPage() {
  const { data, isLoading } = useQuery<WOReport>({
    queryKey: ['reports-work-orders'],
    queryFn: () => api.get('/reports/work-orders').then(r => r.data),
  });

  const SummaryCard = ({ label, value, colour }: { label: string; value: number; colour: string }) => (
    <div className={`bg-white border-2 rounded-xl p-4 ${colour}`}>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
    </div>
  );

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Work Order Analytics</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : !data ? null : (
          <>
            {/* Summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <SummaryCard label="Open" value={data.summary.open} colour="border-[#dc2d2f] text-[#dc2d2f]"/>
              <SummaryCard label="In Progress" value={data.summary.inProgress} colour="border-[#f59e0b] text-[#f59e0b]"/>
              <SummaryCard label="Completed" value={data.summary.completed} colour="border-[#2563eb] text-[#2563eb]"/>
              <SummaryCard label="Overdue" value={data.summary.overdue} colour="border-[#dc2d2f] text-[#dc2d2f]"/>
            </div>

            {/* By site */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-[#e0e0e0]">
                <h2 className="text-sm font-semibold text-[#1a1a1a]">By Site</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-[#e0e0e0]">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Site</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Open</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">In Progress</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Completed</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-[#dc2d2f]">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]">
                  {data.bySite.map(s => (
                    <tr key={s.siteCode} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-[#1a1a1a]">{s.siteName} <span className="text-gray-400 font-normal">({s.siteCode})</span></td>
                      <td className="px-4 py-3 text-right text-[#dc2d2f] font-medium">{s.open}</td>
                      <td className="px-4 py-3 text-right text-[#f59e0b] font-medium">{s.inProgress}</td>
                      <td className="px-4 py-3 text-right text-[#2563eb] font-medium">{s.completed}</td>
                      <td className="px-4 py-3 text-right text-[#dc2d2f] font-bold">{s.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By priority */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4">Open by Priority</h2>
              <div className="space-y-3">
                {data.byPriority.map(p => (
                  <div key={p.priority} className="flex items-center gap-3">
                    <StatusBadge status={p.priority} />
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className="h-2.5 rounded-full bg-[#dc2d2f]"
                        style={{ width: `${data.byPriority.reduce((a, b) => a + b.count, 0) > 0 ? Math.round((p.count / data.byPriority.reduce((a, b) => a + b.count, 0)) * 100) : 0}%` }}/>
                    </div>
                    <span className="text-sm font-medium text-[#1a1a1a] w-6 text-right">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
