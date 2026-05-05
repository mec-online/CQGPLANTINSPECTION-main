import { Suspense, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useGps } from '@/context/GpsContext';

interface Site { id: string; name: string; code: string }
interface Asset { id: string; name: string; plantId: string | null }
interface Template { id: string; name: string; type: string }

function StartInspectionForm() {
  const { user } = useAuth();
  const { position } = useGps();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-populate from QR/NFC scan or PPM Inspect URL params
  const [siteId, setSiteId] = useState(searchParams.get('siteId') || user?.siteId || '');
  const [assetId, setAssetId] = useState(searchParams.get('assetId') || '');
  const [templateId, setTemplateId] = useState(searchParams.get('templateId') || '');

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then((r) => r.data),
  });

  // Resolve site code -> UUID (QR codes embed site code, not UUID)
  useEffect(() => {
    if (!sites) return;
    const rawSiteParam = searchParams.get('siteId');
    if (!rawSiteParam) return;
    const isUuid = sites.some((s) => s.id === rawSiteParam);
    if (!isUuid) {
      const matched = sites.find((s) => s.code === rawSiteParam.toUpperCase());
      if (matched) setSiteId(matched.id);
    }
  }, [sites, searchParams]);

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['site-assets', siteId],
    queryFn: () => api.get(`/sites/${siteId}/assets`).then((r) => r.data),
    enabled: !!siteId,
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then((r) => r.data),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/inspections', {
        templateId,
        assetId: assetId || null,
        siteId,
        locationLat: position?.lat ?? null,
        locationLng: position?.lng ?? null,
      });
      return res.data;
    },
    onSuccess: (data) => {
      navigate(`/inspections/${data.id}`);
    },
  });

  const canStart = siteId && templateId;

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Start Inspection</h1>
          <p className="text-gray-500 text-sm mt-1">Select site, asset and template</p>
        </div>

        {/* GPS status indicator */}
        <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-gray-50 rounded-lg border border-[#e0e0e0]">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${position ? 'bg-[#297e49]' : 'bg-[#f59e0b] animate-pulse'}`} />
          <span className="text-xs text-gray-600">
            {position
              ? `GPS locked — ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} (±${Math.round(position.accuracy)}m)`
              : 'Acquiring GPS...'}
          </span>
        </div>

        <div className="space-y-5">
          {/* Site */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Site *</label>
            <select
              value={siteId}
              onChange={(e) => { setSiteId(e.target.value); setAssetId(''); }}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#dc2d2f] focus:ring-1 focus:ring-[#dc2d2f]"
            >
              <option value="">Select site...</option>
              {sites?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Asset (optional) */}
          {siteId && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Asset (optional)</label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#dc2d2f] focus:ring-1 focus:ring-[#dc2d2f]"
              >
                <option value="">General site inspection (no specific asset)</option>
                {assets?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.plantId ? ` — ${a.plantId}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Inspection Type *</label>
            <div className="space-y-2">
              {templates?.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-colors ${
                    templateId === t.id
                      ? 'border-[#297e49] bg-green-50'
                      : 'border-[#e0e0e0] bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-[#1a1a1a]">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.type}</div>
                </button>
              ))}
            </div>
          </div>

          {startMutation.error && (
            <p className="text-[#dc2d2f] text-sm">Failed to start inspection. Please try again.</p>
          )}

          <button
            onClick={() => startMutation.mutate()}
            disabled={!canStart || startMutation.isPending}
            className="w-full bg-[#297e49] hover:bg-[#1f6338] disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition-colors min-h-[56px]"
          >
            {startMutation.isPending ? 'Starting...' : 'Begin Inspection'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

export default function StartInspectionPage() {
  return (
    <Suspense fallback={<AppShell><div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading...</div></div></AppShell>}>
      <StartInspectionForm />
    </Suspense>
  );
}
