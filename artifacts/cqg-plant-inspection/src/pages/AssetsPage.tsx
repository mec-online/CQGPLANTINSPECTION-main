import { useState, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/context/AuthContext';

interface Asset {
  id: string;
  name: string;
  plantId: string | null;
  manufacturer: string | null;
  model: string | null;
  criticality: string;
  isMobile: boolean;
  isActive: boolean;
  area: { id: string; name: string } | null;
  site: { id: string; name: string; code: string };
  currentSite: { name: string; code: string } | null;
  _count?: { workOrders: number; inspections: number };
}

interface Site { id: string; name: string; code: string }
interface Area { id: string; name: string; siteId: string }

interface AssetFormData {
  name: string;
  plantId: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  installDate: string;
  criticality: string;
  isMobile: boolean;
  areaId: string;
  notes: string;
  siteId: string;
}

function AssetFormModal({
  siteId,
  sites,
  onClose,
  onSuccess,
  isSiteManager,
}: {
  siteId: string;
  sites: Site[];
  onClose: () => void;
  onSuccess: () => void;
  isSiteManager: boolean;
}) {
  const [form, setForm] = useState<AssetFormData>({
    name: '',
    plantId: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    installDate: '',
    criticality: 'MEDIUM',
    isMobile: false,
    areaId: '',
    notes: '',
    siteId: siteId || '',
  });
  const [error, setError] = useState('');

  const { data: areas } = useQuery<Area[]>({
    queryKey: ['site-areas', form.siteId],
    queryFn: () => api.get(`/sites/${form.siteId}/areas`).then((r) => r.data),
    enabled: !!form.siteId,
  });

  const mutation = useMutation({
    mutationFn: (data: AssetFormData) => api.post('/assets', {
      name: data.name,
      plantId: data.plantId || null,
      serialNumber: data.serialNumber || null,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      installDate: data.installDate || null,
      criticality: data.criticality,
      isMobile: data.isMobile,
      areaId: data.areaId || null,
      notes: data.notes || null,
      siteId: data.siteId,
    }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create asset');
    },
  });

  const set = (field: keyof AssetFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required'); return; }
    if (!form.siteId) { setError('Site is required'); return; }
    setError('');
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Add Asset</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl min-h-0 min-w-0">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {!isSiteManager && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Site *</label>
              <select
                required
                value={form.siteId}
                onChange={(e) => set('siteId', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]"
              >
                <option value="">Select site...</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]"
              placeholder="e.g. 50t Weighbridge"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Plant ID</label>
              <input type="text" value={form.plantId} onChange={(e) => set('plantId', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" placeholder="e.g. ALG-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Serial Number</label>
              <input type="text" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturer</label>
              <input type="text" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
              <input type="text" value={form.model} onChange={(e) => set('model', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Install Date</label>
              <input type="date" value={form.installDate} onChange={(e) => set('installDate', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Criticality</label>
              <select value={form.criticality} onChange={(e) => set('criticality', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]">
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Area</label>
            <select value={form.areaId} onChange={(e) => set('areaId', e.target.value)} disabled={!form.siteId}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49] disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">No area / select site first</option>
              {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isMobile" checked={form.isMobile} onChange={(e) => set('isMobile', e.target.checked)} className="w-4 h-4 accent-[#297e49]" />
            <label htmlFor="isMobile" className="text-sm text-gray-700">Mobile asset</label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49] resize-none" placeholder="Optional notes..." />
          </div>

          {error && <p className="text-sm text-[#dc2d2f]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#e0e0e0] rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-[#297e49] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#1f6338] disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Creating...' : 'Create Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssetsContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialSiteId = searchParams.get('siteId') || (user?.siteId ?? '');

  const [siteId, setSiteId] = useState(initialSiteId);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [mobileFilter, setMobileFilter] = useState<'all' | 'fixed' | 'mobile'>('all');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'SITE_MANAGER';
  const isSiteManager = user?.role === 'SITE_MANAGER';

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then((r) => r.data),
  });

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', siteId],
    queryFn: () => api.get(`/assets${siteId ? `?siteId=${siteId}` : ''}`).then((r) => r.data),
    enabled: !!siteId || user?.role === 'ADMIN',
  });

  const filtered = assets?.filter((a) => {
    if (mobileFilter === 'mobile' && !a.isMobile) return false;
    if (mobileFilter === 'fixed' && a.isMobile) return false;
    return (
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.plantId?.toLowerCase().includes(search.toLowerCase()) ||
      a.manufacturer?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Asset Register</h1>
          {canEdit && (
            <button onClick={() => setShowAddModal(true)}
              className="bg-[#297e49] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1f6338] transition-colors flex-shrink-0">
              + Add Asset
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-3">
          {!isSiteManager && (
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
              className="border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#dc2d2f] min-h-0">
              <option value="">All sites</option>
              {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..."
            className="flex-1 border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f] min-h-0" />
        </div>

        {/* Mobile filter pills */}
        <div className="flex gap-2 mb-5">
          {(['all', 'fixed', 'mobile'] as const).map((f) => (
            <button key={f} onClick={() => setMobileFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-0 ${
                mobileFilter === f
                  ? f === 'mobile' ? 'bg-blue-600 text-white' : 'bg-[#1a1a1a] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f === 'all' ? 'All' : f === 'mobile' ? 'Mobile' : 'Fixed'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : !filtered?.length ? (
          <div className="text-center py-16 text-gray-400 text-sm">No assets found</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((asset) => (
              <Link key={asset.id} to={`/assets/${asset.id}`}
                className="block bg-white border border-[#e0e0e0] rounded-xl p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    asset.criticality === 'HIGH' ? 'bg-[#dc2d2f]' :
                    asset.criticality === 'MEDIUM' ? 'bg-[#f59e0b]' : 'bg-[#9ca3af]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#1a1a1a]">{asset.name}</p>
                      {asset.isMobile && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Mobile</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[asset.plantId, asset.manufacturer, asset.model].filter(Boolean).join(' · ')}
                    </p>
                    {asset.area && <p className="text-xs text-gray-400 mt-0.5">{asset.area.name}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">Home: {asset.site.name}</p>
                    {asset.isMobile && asset.currentSite && asset.currentSite.code !== asset.site.code && (
                      <p className="text-xs text-blue-600 font-medium mt-0.5">Currently at: {asset.currentSite.name}</p>
                    )}
                  </div>
                  <div className="text-right flex flex-col gap-1 items-end">
                    <StatusBadge status={asset.criticality} />
                    {asset._count && (
                      <div className="text-xs text-gray-400">
                        {asset._count.workOrders} WO · {asset._count.inspections} insp
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AssetFormModal
          siteId={siteId || user?.siteId || ''}
          sites={sites || []}
          isSiteManager={isSiteManager}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['assets'] })}
        />
      )}
    </AppShell>
  );
}

export default function AssetsPage() {
  return (
    <Suspense>
      <AssetsContent />
    </Suspense>
  );
}
