import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { Link } from 'react-router-dom';

interface FailureEntry {
  assetId: string;
  assetName: string;
  plantId: string | null;
  siteCode: string;
  failCount: number;
  workOrderCount: number;
  questions: Array<{ text: string; count: number }>;
}

export default function ReportFailuresPage() {
  const { data, isLoading } = useQuery<FailureEntry[]>({
    queryKey: ['reports-failures'],
    queryFn: () => api.get('/reports/failures').then(r => r.data),
  });

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Repeat Failure Analysis</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : !data?.length ? (
          <div className="text-center py-16 text-gray-400">No failure data found.</div>
        ) : (
          <div className="space-y-4">
            {data.map(entry => (
              <div key={entry.assetId} className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-[#e0e0e0] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">
                      {entry.assetName}
                      {entry.plantId && <span className="text-gray-400 font-normal ml-1">({entry.plantId})</span>}
                    </p>
                    <p className="text-xs text-gray-500">{entry.siteCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#dc2d2f]">{entry.failCount}</p>
                    <p className="text-xs text-gray-500">failures</p>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Top failing checks</p>
                  <div className="space-y-1">
                    {entry.questions.slice(0, 5).map((q, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="h-2 bg-[#dc2d2f] rounded-full flex-shrink-0" style={{ width: `${Math.round((q.count / entry.failCount) * 100)}%`, minWidth: '8px', maxWidth: '200px' }}/>
                            <span className="text-xs text-[#dc2d2f] font-medium">{q.count}</span>
                          </div>
                          <p className="text-xs text-gray-600 truncate mt-0.5">{q.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {entry.workOrderCount > 0 && (
                    <p className="text-xs text-gray-400 mt-2">{entry.workOrderCount} work order{entry.workOrderCount !== 1 ? 's' : ''} raised</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
