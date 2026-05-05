import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';

interface ComplianceData {
  period: { from: string; to: string };
  bySite: Array<{
    site: { id: string; name: string; code: string };
    total: number;
    completed: number;
    passed: number;
    failed: number;
    monitored: number;
    complianceRate: number | null;
  }>;
}

export default function CompliancePage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading } = useQuery<ComplianceData>({
    queryKey: ['compliance', from, to],
    queryFn: () => api.get(`/reports/compliance?from=${from}&to=${to}`).then((r) => r.data),
  });

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Compliance Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">Inspection completion rate by site</p>
        </div>

        {/* Date filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#dc2d2f] min-h-0" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#dc2d2f] min-h-0" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-4">
            {data?.bySite.map((item) => {
              const rate = item.complianceRate;
              const barColour = rate == null ? '#9ca3af' : rate >= 80 ? '#297e49' : rate >= 60 ? '#f59e0b' : '#dc2d2f';

              return (
                <div key={item.site.id} className="bg-white border border-[#e0e0e0] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="font-semibold text-[#1a1a1a]">{item.site.name}</h2>
                      <span className="text-xs text-gray-400">{item.site.code}</span>
                    </div>
                    <span className="text-3xl font-bold" style={{ color: barColour }}>
                      {rate != null ? `${rate}%` : '—'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{ width: `${rate ?? 0}%`, backgroundColor: barColour }}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-lg">{item.total}</div>
                      <div className="text-gray-400">Total</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg text-[#297e49]">{item.passed}</div>
                      <div className="text-gray-400">Pass</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg text-[#dc2d2f]">{item.failed}</div>
                      <div className="text-gray-400">Fail</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg text-[#f59e0b]">{item.monitored}</div>
                      <div className="text-gray-400">Monitor</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!data?.bySite.length && (
              <div className="text-center py-12 text-gray-400 text-sm">No data for selected period</div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
