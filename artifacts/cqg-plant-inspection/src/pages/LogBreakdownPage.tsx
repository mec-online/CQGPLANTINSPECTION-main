import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';

interface Site { id: string; name: string; code: string }
interface Asset { id: string; name: string; plantId: string | null }

export default function LogBreakdownPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [siteId, setSiteId] = useState(user?.siteId || '');
  const [assetId, setAssetId] = useState('');
  const [description, setDescription] = useState('');
  const [cause, setCause] = useState('');
  const [area, setArea] = useState('');
  const [startedAt, setStartedAt] = useState(localNow);
  const [success, setSuccess] = useState(false);

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then((r) => r.data),
  });

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['site-assets', siteId],
    queryFn: () => api.get(`/sites/${siteId}/assets`).then((r) => r.data),
    enabled: !!siteId,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  });

  const causes: string[] = settings?.find((s: { key: string; value: unknown }) => s.key === 'breakdown_causes')?.value || [];

  const mutation = useMutation({
    mutationFn: () => api.post('/breakdowns', { assetId, siteId, description, cause: cause || null, area: area || null, startedAt: new Date(startedAt).toISOString() }),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/breakdowns'), 2000);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (success) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] mb-2">Breakdown Logged</h2>
          <p className="text-gray-500 text-sm">Redirecting to home...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Log Breakdown</h1>
          <p className="text-gray-500 text-sm mt-1">Record an equipment failure or breakdown</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Site */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Site *</label>
            <select
              value={siteId}
              onChange={(e) => { setSiteId(e.target.value); setAssetId(''); }}
              required
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#dc2d2f]"
            >
              <option value="">Select site...</option>
              {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Asset */}
          {siteId && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Asset *</label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                required
                className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#dc2d2f]"
              >
                <option value="">Select asset...</option>
                {assets?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.plantId ? ` — ${a.plantId}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Area / location */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Area / Location</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Primary Crusher, Feed hopper"
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#dc2d2f]"
            />
          </div>

          {/* Breakdown start time */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Breakdown Started *</label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              required
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#dc2d2f]"
            />
            <p className="text-xs text-gray-400 mt-1">Set to when the breakdown actually occurred</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="Describe what happened..."
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base resize-none focus:outline-none focus:border-[#dc2d2f]"
            />
          </div>

          {/* Cause */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Known Cause</label>
            <select
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#dc2d2f]"
            >
              <option value="">Unknown / to be determined</option>
              {causes.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {mutation.error && (
            <p className="text-[#dc2d2f] text-sm">Failed to log breakdown. Please try again.</p>
          )}

          <button
            type="submit"
            disabled={!siteId || !assetId || !description || mutation.isPending}
            className="w-full bg-[#dc2d2f] hover:bg-[#b52527] disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition-colors min-h-[56px]"
          >
            {mutation.isPending ? 'Logging...' : 'Log Breakdown'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
