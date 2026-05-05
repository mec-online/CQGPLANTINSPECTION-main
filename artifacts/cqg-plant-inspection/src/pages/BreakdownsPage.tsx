import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';

interface Breakdown {
  id: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
  manHours: number | null;
  partsCost: number | null;
  description: string;
  cause: string | null;
  resolution: string | null;
  area: string | null;
  asset: { id: string; name: string; plantId: string | null };
  site: { id: string; name: string; code: string };
  reportedBy: { id: string; name: string };
  _count: { attachments: number };
}

function formatDuration(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ResolveModal({ breakdown, onClose }: { breakdown: Breakdown; onClose: () => void }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [resolvedAt, setResolvedAt] = useState(localNow);
  const [resolution, setResolution] = useState('');
  const [cause, setCause] = useState(breakdown.cause || '');
  const [manHours, setManHours] = useState('');
  const [partsCost, setPartsCost] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  });
  const causes: string[] = settings?.find((s: { key: string }) => s.key === 'breakdown_causes')?.value || [];

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/breakdowns/${breakdown.id}/resolve`, {
        resolution: resolution || null,
        cause: cause || null,
        manHours: manHours ? parseFloat(manHours) : null,
        partsCost: partsCost ? parseFloat(partsCost) : null,
        resolvedAt: new Date(resolvedAt).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breakdowns'] });
      onClose();
    },
  });

  // Compute downtime preview
  const startMs = new Date(breakdown.startedAt).getTime();
  const endMs = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const previewMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
          <div>
            <h2 className="font-semibold text-[#1a1a1a] text-lg">Close Breakdown</h2>
            <p className="text-xs text-gray-500 mt-0.5">{breakdown.asset.name} — {breakdown.description.slice(0, 60)}{breakdown.description.length > 60 ? '...' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Downtime preview */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Breakdown started</p>
              <p className="text-sm font-medium text-[#1a1a1a]">
                {new Date(breakdown.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total downtime</p>
              <p className="text-sm font-semibold text-[#dc2d2f]">{formatDuration(previewMinutes)}</p>
            </div>
          </div>

          {/* Finished at */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Breakdown Finished *</label>
            <input
              type="datetime-local"
              value={resolvedAt}
              onChange={(e) => setResolvedAt(e.target.value)}
              required
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#297e49]"
            />
          </div>

          {/* Man hours */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Man Hours to Fix</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={manHours}
              onChange={(e) => setManHours(e.target.value)}
              placeholder="e.g. 2.5"
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#297e49]"
            />
          </div>

          {/* Parts cost */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Parts Cost (£)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={partsCost}
                onChange={(e) => setPartsCost(e.target.value)}
                placeholder="0.00"
                className="w-full border border-[#e0e0e0] rounded-lg pl-8 pr-4 py-3 text-base focus:outline-none focus:border-[#297e49]"
              />
            </div>
          </div>

          {/* Cause */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Confirmed Cause</label>
            <select
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#297e49]"
            >
              <option value="">Unknown / not determined</option>
              {causes.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Resolution notes */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Resolution / Work Done</label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              placeholder="What was done to fix the breakdown?"
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base resize-none focus:outline-none focus:border-[#297e49]"
            />
          </div>

          {mutation.isError && (
            <p className="text-[#dc2d2f] text-sm">Failed to close breakdown. Please try again.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#e0e0e0] flex gap-3">
          <button onClick={onClose} className="flex-1 border border-[#e0e0e0] text-[#1a1a1a] font-semibold py-3 rounded-xl transition-colors hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!resolvedAt || mutation.isPending}
            className="flex-1 bg-[#297e49] hover:bg-[#1f6338] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {mutation.isPending ? 'Saving...' : 'Close Breakdown'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BreakdownsPage() {
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [resolving, setResolving] = useState<Breakdown | null>(null);

  const { data, isLoading } = useQuery<{ breakdowns: Breakdown[]; total: number }>({
    queryKey: ['breakdowns'],
    queryFn: () => api.get('/breakdowns?limit=100').then((r) => r.data),
  });

  const open = data?.breakdowns.filter((b) => !b.resolvedAt) || [];
  const resolved = data?.breakdowns.filter((b) => b.resolvedAt) || [];
  const displayed = tab === 'open' ? open : resolved;

  const totalPartsCost = resolved.reduce((sum, b) => sum + (b.partsCost || 0), 0);
  const totalManHours = resolved.reduce((sum, b) => sum + (b.manHours || 0), 0);

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#1a1a1a]">Breakdowns</h1>
            <p className="text-gray-500 text-sm mt-0.5">Equipment failures and downtime</p>
          </div>
          <Link
            to="/breakdowns/log"
            className="bg-[#dc2d2f] hover:bg-[#b52527] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            + Log Breakdown
          </Link>
        </div>

        {/* Summary stats for resolved */}
        {resolved.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#dc2d2f]">{open.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Open</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#1a1a1a]">{totalManHours > 0 ? totalManHours.toFixed(1) : '—'}</div>
              <div className="text-xs text-gray-500 mt-0.5">Total Man Hours</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#1a1a1a]">{totalPartsCost > 0 ? `£${totalPartsCost.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}</div>
              <div className="text-xs text-gray-500 mt-0.5">Total Parts Cost</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab('open')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'open' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-gray-500'}`}
          >
            Open ({open.length})
          </button>
          <button
            onClick={() => setTab('resolved')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'resolved' ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-gray-500'}`}
          >
            Resolved ({resolved.length})
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">{tab === 'open' ? '✓' : '📋'}</div>
            <p className="font-medium">{tab === 'open' ? 'No open breakdowns' : 'No resolved breakdowns yet'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((b) => (
              <div key={b.id} className="bg-white border border-[#e0e0e0] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1a1a] leading-snug">{b.asset.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.site.code}{b.area ? ` · ${b.area}` : ''} · {b.reportedBy.name}
                    </p>
                  </div>
                  {b.resolvedAt ? (
                    <StatusBadge status="RESOLVED" />
                  ) : (
                    <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">OPEN</span>
                  )}
                </div>

                <p className="text-sm text-gray-700 mb-3 line-clamp-2">{b.description}</p>

                {/* Time info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                  <span>Started: {new Date(b.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {b.resolvedAt && (
                    <span>Resolved: {new Date(b.resolvedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                  {b.durationMinutes != null && (
                    <span className="font-medium text-gray-700">Downtime: {formatDuration(b.durationMinutes)}</span>
                  )}
                </div>

                {/* Cost / hours row */}
                {(b.manHours != null || b.partsCost != null) && (
                  <div className="flex gap-4 text-xs mb-3">
                    {b.manHours != null && (
                      <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                        <span className="text-blue-700 font-semibold">{b.manHours}h</span>
                        <span className="text-blue-500 ml-1">man hours</span>
                      </div>
                    )}
                    {b.partsCost != null && (
                      <div className="bg-amber-50 rounded-lg px-3 py-1.5">
                        <span className="text-amber-700 font-semibold">£{b.partsCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-amber-500 ml-1">parts</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cause / resolution */}
                {b.cause && <p className="text-xs text-gray-500 mb-1">Cause: <span className="text-gray-700">{b.cause}</span></p>}
                {b.resolution && <p className="text-xs text-gray-500">Resolution: <span className="text-gray-700">{b.resolution}</span></p>}

                {/* Close button for open breakdowns */}
                {!b.resolvedAt && (
                  <button
                    onClick={() => setResolving(b)}
                    className="mt-3 w-full border-2 border-[#297e49] text-[#297e49] hover:bg-[#297e49] hover:text-white font-semibold py-2 rounded-xl text-sm transition-colors"
                  >
                    Close Breakdown
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {resolving && <ResolveModal breakdown={resolving} onClose={() => setResolving(null)} />}
    </AppShell>
  );
}
