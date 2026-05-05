import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';

interface AssetTrend {
  assetId: string;
  assetName: string;
  plantId: string | null;
  siteCode: string;
  count: number;
  totalDowntimeMinutes: number;
  avgDowntimeMinutes: number;
  lastBreakdownAt: string | null;
  mtbfDays: number | null;
  predictedNextAt: string | null;
}

interface SiteTrend { siteId: string; siteName: string; siteCode: string; count: number; totalDowntimeMinutes: number; }
interface MonthTrend { month: string; count: number; totalDowntimeMinutes: number; }
interface CauseTrend { cause: string; count: number; }

interface TrendsData {
  byAsset: AssetTrend[];
  bySite: SiteTrend[];
  byMonth: MonthTrend[];
  byCause: CauseTrend[];
  total: number;
}

interface AIPrediction {
  prediction: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  daysUntilPredicted: number | null;
  recommendations: string[];
}

interface Site { id: string; name: string; code: string }

function riskColour(risk: string) {
  if (risk === 'HIGH') return 'text-[#dc2d2f] bg-red-50 border-red-200';
  if (risk === 'MEDIUM') return 'text-[#f59e0b] bg-amber-50 border-amber-200';
  return 'text-[#297e49] bg-green-50 border-green-200';
}

function riskBadgeColour(risk: string) {
  if (risk === 'HIGH') return 'bg-red-100 text-red-700';
  if (risk === 'MEDIUM') return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatMonth(m: string) {
  const [year, month] = m.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function MiniBarChart({ data, valueKey, labelKey, colour = '#297e49' }: { data: Record<string, unknown>[]; valueKey: string; labelKey: string; colour?: string }) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-28 text-xs text-gray-600 truncate flex-shrink-0 text-right">{String(d[labelKey])}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-5 rounded-full flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.max((Number(d[valueKey]) / max) * 100, 4)}%`, backgroundColor: colour }}
            >
              <span className="text-white text-xs font-bold">{String(d[valueKey])}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssetPredictionCard({ asset }: { asset: AssetTrend }) {
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const days = daysUntil(asset.predictedNextAt);
  const overdue = days !== null && days < 0;
  const soonDue = days !== null && days >= 0 && days <= 14;

  const autoRisk = overdue ? 'HIGH' : soonDue ? 'MEDIUM' : 'LOW';
  const displayRisk = prediction?.riskLevel || autoRisk;

  const fetchPrediction = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/breakdowns/predict/${asset.assetId}`);
      setPrediction(res.data);
    } catch {
      setError('Prediction unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white border-2 rounded-xl p-4 transition-colors ${riskColour(displayRisk)}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-[#1a1a1a] text-sm">{asset.assetName}</p>
          <p className="text-xs text-gray-500">{asset.plantId || asset.siteCode}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${riskBadgeColour(displayRisk)}`}>
          {displayRisk} RISK
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <div>
          <p className="text-lg font-bold text-[#1a1a1a]">{asset.count}</p>
          <p className="text-xs text-gray-500">Breakdowns</p>
        </div>
        <div>
          <p className="text-lg font-bold text-[#1a1a1a]">{asset.mtbfDays ?? '—'}</p>
          <p className="text-xs text-gray-500">MTBF (days)</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${overdue ? 'text-[#dc2d2f]' : 'text-[#1a1a1a]'}`}>
            {days === null ? '—' : overdue ? `${Math.abs(days)}d late` : `${days}d`}
          </p>
          <p className="text-xs text-gray-500">{overdue ? 'Overdue' : 'Days to pred.'}</p>
        </div>
      </div>

      {asset.lastBreakdownAt && (
        <p className="text-xs text-gray-500 mb-3">
          Last breakdown: {new Date(asset.lastBreakdownAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {prediction ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-700 leading-relaxed">{prediction.prediction}</p>
          {prediction.recommendations.length > 0 && (
            <ul className="text-xs text-gray-600 space-y-1">
              {prediction.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-[#297e49] flex-shrink-0">›</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button
          onClick={fetchPrediction}
          disabled={loading}
          className="w-full text-xs font-semibold py-2 rounded-lg border border-current transition-colors hover:opacity-80 disabled:opacity-50"
        >
          {loading ? 'Analysing...' : '✦ Get AI Prediction'}
        </button>
      )}
      {error && <p className="text-xs text-[#dc2d2f] mt-1">{error}</p>}
    </div>
  );
}

export default function TrendsPage() {
  const { user } = useAuth();
  const [siteId, setSiteId] = useState(user?.siteId || '');

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  });

  const { data: trends, isLoading } = useQuery<TrendsData>({
    queryKey: ['breakdown-trends', siteId],
    queryFn: () => api.get(`/breakdowns/trends${siteId ? `?siteId=${siteId}` : ''}`).then(r => r.data),
  });

  const maxMonthCount = Math.max(...(trends?.byMonth.map(m => m.count) || [0]), 1);

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#1a1a1a]">Breakdown Trends</h1>
            <p className="text-gray-500 text-sm mt-0.5">Analysis and AI-powered predictions</p>
          </div>
          {(user?.role === 'ADMIN' || !user?.siteId) && (
            <select value={siteId} onChange={e => setSiteId(e.target.value)}
              className="border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#dc2d2f]">
              <option value="">All Sites</option>
              {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"/>)}
          </div>
        ) : trends?.total === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-medium">No breakdown data yet</p>
            <p className="text-sm mt-1">Log breakdowns to see trends and predictions</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Breakdowns', value: trends?.total ?? 0, colour: 'text-[#dc2d2f]' },
                { label: 'Assets Affected', value: trends?.byAsset.length ?? 0, colour: 'text-[#f59e0b]' },
                { label: 'Avg Downtime', value: trends?.byAsset.length ? `${Math.round(trends.byAsset.reduce((a,b) => a + b.avgDowntimeMinutes, 0) / trends.byAsset.length)}m` : '—', colour: 'text-[#297e49]' },
                { label: 'High Risk Assets', value: trends?.byAsset.filter(a => { const d = daysUntil(a.predictedNextAt); return d !== null && d < 0; }).length ?? 0, colour: 'text-[#dc2d2f]' },
              ].map((stat, i) => (
                <div key={i} className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.colour}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Monthly trend chart */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Monthly Breakdown Trend</h2>
              <div className="flex items-end gap-1.5 h-28">
                {trends?.byMonth.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">{m.count > 0 ? m.count : ''}</span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max((m.count / maxMonthCount) * 80, m.count > 0 ? 4 : 1)}px`,
                        backgroundColor: m.count > 0 ? '#dc2d2f' : '#e5e7eb',
                      }}
                    />
                    <span className="text-xs text-gray-400 hidden sm:block">{formatMonth(m.month)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1 sm:hidden">
                <span>{trends?.byMonth[0] ? formatMonth(trends.byMonth[0].month) : ''}</span>
                <span>{trends?.byMonth[11] ? formatMonth(trends.byMonth[11].month) : ''}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {trends?.byAsset && trends.byAsset.length > 0 && (
                <div className="bg-white border border-[#e0e0e0] rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Breakdowns by Asset</h2>
                  <MiniBarChart
                    data={trends.byAsset.slice(0, 8).map(a => ({ label: a.assetName.replace(/^[A-Z]{3} /, ''), count: a.count }))}
                    valueKey="count" labelKey="label" colour="#dc2d2f"
                  />
                </div>
              )}
              {trends?.byCause && trends.byCause.length > 0 && (
                <div className="bg-white border border-[#e0e0e0] rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Breakdown Causes</h2>
                  <MiniBarChart
                    data={trends.byCause.slice(0, 8).map(c => ({ label: c.cause, count: c.count }))}
                    valueKey="count" labelKey="label" colour="#f59e0b"
                  />
                </div>
              )}
            </div>

            {trends?.bySite && trends.bySite.length > 1 && (
              <div className="bg-white border border-[#e0e0e0] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Breakdowns by Site</h2>
                <MiniBarChart
                  data={trends.bySite.map(s => ({ label: s.siteName, count: s.count }))}
                  valueKey="count" labelKey="label" colour="#297e49"
                />
              </div>
            )}

            {trends?.byAsset && trends.byAsset.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Asset Predictions</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trends.byAsset.map(asset => (
                    <AssetPredictionCard key={asset.assetId} asset={asset} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
