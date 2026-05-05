import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/context/AuthContext';

interface Area { id: string; name: string; siteId: string }

interface EditAssetFormData {
  name: string;
  plantId: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  installDate: string;
  criticality: string;
  isMobile: boolean;
  isActive: boolean;
  areaId: string;
  notes: string;
}

function EditAssetModal({
  asset,
  onClose,
  onSuccess,
}: {
  asset: AssetDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<EditAssetFormData>({
    name: asset.name,
    plantId: asset.plantId || '',
    serialNumber: asset.serialNumber || '',
    manufacturer: asset.manufacturer || '',
    model: asset.model || '',
    installDate: asset.installDate ? asset.installDate.slice(0, 10) : '',
    criticality: asset.criticality,
    isMobile: asset.isMobile,
    isActive: asset.isActive,
    areaId: asset.area ? asset.area.id : '',
    notes: asset.notes || '',
  });
  const [error, setError] = useState('');

  const { data: areas } = useQuery<Area[]>({
    queryKey: ['site-areas', asset.site.id],
    queryFn: () => api.get(`/sites/${asset.site.id}/areas`).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: EditAssetFormData) => api.put(`/assets/${asset.id}`, {
      name: data.name,
      plantId: data.plantId || null,
      serialNumber: data.serialNumber || null,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      installDate: data.installDate || null,
      criticality: data.criticality,
      isMobile: data.isMobile,
      isActive: data.isActive,
      areaId: data.areaId || null,
      notes: data.notes || null,
    }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to update asset');
    },
  });

  const set = (field: keyof EditAssetFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required'); return; }
    setError('');
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Edit Asset</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl min-h-0 min-w-0">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input required type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Plant ID</label>
              <input type="text" value={form.plantId} onChange={(e) => set('plantId', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
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
            <select value={form.areaId} onChange={(e) => set('areaId', e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]">
              <option value="">No area</option>
              {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="editIsMobile" checked={form.isMobile} onChange={(e) => set('isMobile', e.target.checked)} className="w-4 h-4 accent-[#297e49]" />
              <label htmlFor="editIsMobile" className="text-sm text-gray-700">Mobile asset</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="editIsActive" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-[#297e49]" />
              <label htmlFor="editIsActive" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49] resize-none" />
          </div>
          {error && <p className="text-sm text-[#dc2d2f]">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#e0e0e0] rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-[#297e49] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#1f6338] disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DuplicateAssetModal({ asset, onClose }: { asset: AssetDetail; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<EditAssetFormData>({
    name: `${asset.name} (Copy)`,
    plantId: asset.plantId || '',
    serialNumber: asset.serialNumber || '',
    manufacturer: asset.manufacturer || '',
    model: asset.model || '',
    installDate: asset.installDate ? asset.installDate.slice(0, 10) : '',
    criticality: asset.criticality,
    isMobile: asset.isMobile,
    isActive: asset.isActive,
    areaId: asset.area ? asset.area.id : '',
    notes: asset.notes || '',
  });
  const [error, setError] = useState('');

  const { data: areas } = useQuery<Area[]>({
    queryKey: ['site-areas', asset.site.id],
    queryFn: () => api.get(`/sites/${asset.site.id}/areas`).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: EditAssetFormData) => api.post('/assets', {
      siteId: asset.siteId,
      areaId: data.areaId || null,
      name: data.name,
      plantId: data.plantId || null,
      serialNumber: data.serialNumber || null,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      installDate: data.installDate || null,
      criticality: data.criticality,
      isMobile: data.isMobile,
      notes: data.notes || null,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      navigate(`/assets/${res.data.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to duplicate asset');
    },
  });

  const set = (field: keyof EditAssetFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Duplicate Asset</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl min-h-0 min-w-0">✕</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.name) { setError('Name is required'); return; } setError(''); mutation.mutate(form); }} className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            Creating a copy of <strong>{asset.name}</strong> at {asset.site.name}. Edit the name and any fields before saving.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input required type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Plant ID</label>
              <input type="text" value={form.plantId} onChange={(e) => set('plantId', e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]" />
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
            <select value={form.areaId} onChange={(e) => set('areaId', e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]">
              <option value="">No area</option>
              {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="dupIsMobile" checked={form.isMobile} onChange={(e) => set('isMobile', e.target.checked)} className="w-4 h-4 accent-[#297e49]" />
              <label htmlFor="dupIsMobile" className="text-sm text-gray-700">Mobile asset</label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49] resize-none" />
          </div>
          {error && <p className="text-sm text-[#dc2d2f]">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#e0e0e0] rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-[#297e49] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#1f6338] disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Duplicating...' : 'Create Duplicate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ASSET_PPM_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
const ASSET_PPM_FREQ_LABEL: Record<string, string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUAL: 'Annual',
};
const ASSET_TEMPLATE_TYPE_LABEL: Record<string, string> = {
  PRESTART: 'Pre-Start', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly',
  PRE_MOVEMENT: 'Pre-Movement', POST_MOVEMENT: 'Post-Movement',
};

interface TemplateOption { id: string; name: string; type: string }

function AddAssetPPMModal({ assetId, assetName, siteId, onClose, onSuccess }: {
  assetId: string; assetName: string; siteId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [nextDueAt, setNextDueAt] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: templates } = useQuery<TemplateOption[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => api.post('/ppm', {
      assetId, siteId, taskName, description: description || null, templateId: templateId || null,
      frequency, nextDueAt: new Date(nextDueAt).toISOString(), notes: notes || null,
    }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create PPM task');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
          <div>
            <h2 className="font-semibold text-[#1a1a1a] text-lg">New PPM Task</h2>
            <p className="text-xs text-gray-400 mt-0.5">{assetName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Task Name *</label>
            <input type="text" value={taskName} onChange={e => setTaskName(e.target.value)} required
              placeholder="e.g. Yearly screen mat change"
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#297e49]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Description / Instructions</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Detailed instructions for carrying out this task..."
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base resize-none focus:outline-none focus:border-[#297e49]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Inspection Template (optional)</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#297e49]">
              <option value="">No template — mark done only</option>
              {templates?.map(t => (
                <option key={t.id} value={t.id}>{t.name} [{ASSET_TEMPLATE_TYPE_LABEL[t.type] || t.type}]</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Frequency *</label>
            <div className="grid grid-cols-5 gap-2">
              {ASSET_PPM_FREQUENCIES.map(f => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                    frequency === f ? 'bg-[#153f26] border-[#153f26] text-white' : 'bg-white border-[#e0e0e0] text-gray-600 hover:border-gray-400'
                  }`}>
                  {ASSET_PPM_FREQ_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Next Due Date *</label>
            <input type="date" value={nextDueAt} onChange={e => setNextDueAt(e.target.value)} required
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#297e49]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base resize-none focus:outline-none focus:border-[#297e49]" />
          </div>
          {error && <p className="text-[#dc2d2f] text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-[#e0e0e0] flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-[#e0e0e0] rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={() => { if (!taskName || !nextDueAt) { setError('Task name and due date are required'); return; } mutation.mutate(); }}
            disabled={mutation.isPending}
            className="flex-1 bg-[#297e49] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#1f6338] disabled:opacity-50 transition-colors">
            {mutation.isPending ? 'Saving...' : 'Create PPM Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AssetDetail {
  id: string;
  name: string;
  plantId: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  installDate: string | null;
  criticality: string;
  isMobile: boolean;
  isActive: boolean;
  notes: string | null;
  siteId: string;
  site: { id: string; name: string; code: string };
  area: { id: string; name: string } | null;
  ppmSchedules: Array<{
    id: string;
    taskName: string;
    frequency: string;
    nextDueAt: string;
    lastCompletedAt: string | null;
    _count: { completions: number };
  }>;
}

interface History {
  inspections: Array<{ id: string; startedAt: string; status: string; overallResult: string | null; template: { name: string; type: string }; completedBy: { name: string } | null }>;
  workOrders: Array<{ id: string; title: string; priority: string; status: string; createdAt: string; completedAt: string | null; createdBy: { name: string }; assignedTo: { name: string } | null }>;
  breakdowns: Array<{ id: string; startedAt: string; resolvedAt: string | null; durationMinutes: number | null; description: string; cause: string | null }>;
}

interface Schedule {
  id: string;
  templateId: string;
  assetId: string | null;
  siteId: string;
  frequency: string;
  nextDueAt: string;
  assignedRoleId: string | null;
  template: { id: string; name: string; type: string };
}

interface Template {
  id: string;
  name: string;
  type: string;
}

const TABS = ['Overview', 'Inspections', 'Work Orders', 'Breakdowns', 'PPM', 'Templates', 'NFC/QR'] as const;
type Tab = typeof TABS[number];

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];

function AssignTemplateSection({ assetId, siteId }: { assetId: string; siteId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SITE_MANAGER';

  const [templateId, setTemplateId] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [nextDueAt, setNextDueAt] = useState('');

  const { data: schedules } = useQuery<Schedule[]>({
    queryKey: ['asset-schedules', assetId],
    queryFn: () => api.get(`/inspections/schedules?assetId=${assetId}`).then(r => r.data),
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
    enabled: canEdit,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.post('/inspections/schedules', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-schedules', assetId] });
      setTemplateId(''); setFrequency('MONTHLY'); setNextDueAt('');
    },
    onError: (err: unknown) => { console.error('Schedule create error:', err); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inspections/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-schedules', assetId] }),
  });

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId || !nextDueAt) return;
    createMutation.mutate({ templateId, assetId, siteId, frequency, nextDueAt });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e0e0e0] bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Templates</p>
        </div>
        {!schedules?.length ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">No templates assigned to this asset</div>
        ) : (
          <div className="divide-y divide-[#e0e0e0]">
            {schedules.map(s => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1a1a1a]">{s.template.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.frequency} · Due {new Date(s.nextDueAt).toLocaleDateString('en-GB')}</p>
                </div>
                {canEdit && (
                  <button onClick={() => deleteMutation.mutate(s.id)}
                    className="text-xs text-[#dc2d2f] font-medium hover:underline min-h-0 min-w-0">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assign Template</p>
          <form onSubmit={handleAssign} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Template</label>
              <select required value={templateId} onChange={e => setTemplateId(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]">
                <option value="">Select template...</option>
                {templates?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)}
                  className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]">
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Next Due</label>
                <input required type="date" value={nextDueAt} onChange={e => setNextDueAt(e.target.value)}
                  className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#297e49]"/>
              </div>
            </div>
            {createMutation.isError && (
              <p className="text-[#dc2d2f] text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Failed to assign template. Check you have the correct permissions and try again.
              </p>
            )}
            <button type="submit" disabled={!templateId || !nextDueAt || createMutation.isPending}
              className="w-full bg-[#297e49] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1f6338] disabled:opacity-50 transition-colors">
              {createMutation.isPending ? 'Assigning...' : 'Assign Template'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('Overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showAddPPM, setShowAddPPM] = useState(false);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SITE_MANAGER';

  const { data: asset, isLoading } = useQuery<AssetDetail>({
    queryKey: ['asset', id],
    queryFn: () => api.get(`/assets/${id}`).then((r) => r.data),
  });

  const { data: history } = useQuery<History>({
    queryKey: ['asset-history', id],
    queryFn: () => api.get(`/assets/${id}/history`).then((r) => r.data),
    enabled: tab !== 'Overview' && tab !== 'Templates' && tab !== 'NFC/QR',
  });

  if (isLoading || !asset) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      </AppShell>
    );
  }

  const nfcUrl = `cqg-plant://asset?id=${asset.id}&site=${asset.site.code}`;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 min-h-0 min-w-0 hover:text-[#1a1a1a]">← Back</button>
          {canEdit && (
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowDuplicate(true)}
                className="text-sm font-semibold text-gray-500 border border-gray-300 px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors min-h-0">Duplicate</button>
              <button onClick={() => setShowEditModal(true)}
                className="text-sm font-semibold text-[#297e49] border border-[#297e49] px-4 py-1.5 rounded-lg hover:bg-[#297e49] hover:text-white transition-colors min-h-0">Edit Asset</button>
            </div>
          )}
        </div>

        {/* Asset header */}
        <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-semibold text-[#1a1a1a] leading-tight">{asset.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{asset.site.name} · {asset.site.code}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <StatusBadge status={asset.criticality} size="md" />
              {asset.isMobile && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Mobile</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {asset.plantId && <InfoItem label="Plant ID" value={asset.plantId} />}
            {asset.serialNumber && <InfoItem label="Serial No." value={asset.serialNumber} />}
            {asset.manufacturer && <InfoItem label="Manufacturer" value={asset.manufacturer} />}
            {asset.model && <InfoItem label="Model" value={asset.model} />}
            {asset.area && <InfoItem label="Area" value={asset.area.name} />}
            {asset.installDate && <InfoItem label="Installed" value={new Date(asset.installDate).toLocaleDateString('en-GB')} />}
          </div>
          {asset.notes && (
            <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-50">{asset.notes}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-0 ${
                tab === t ? 'bg-[#1a1a1a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'Overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Inspections" value={history?.inspections.length ?? '—'} />
              <StatBox label="Work Orders" value={history?.workOrders.length ?? '—'} />
              <StatBox label="Breakdowns" value={history?.breakdowns.length ?? '—'} />
            </div>
            <div className="flex gap-3">
              <Link to={`/inspections/start?assetId=${asset.id}&siteId=${asset.site.code}`} className="flex-1 bg-[#297e49] text-white text-sm font-semibold rounded-xl py-3 text-center hover:bg-[#1f6338] transition-colors">
                Start Inspection
              </Link>
              <Link to={`/breakdowns/log?assetId=${asset.id}`} className="flex-1 bg-[#dc2d2f] text-white text-sm font-semibold rounded-xl py-3 text-center hover:bg-[#b52527] transition-colors">
                Log Breakdown
              </Link>
            </div>
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset QR Code</p>
                <button onClick={() => setTab('NFC/QR')} className="text-xs text-[#297e49] hover:underline min-h-0 min-w-0">View NFC/QR setup →</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white border border-[#e0e0e0] rounded-lg inline-block">
                  <QRCodeSVG value={nfcUrl} size={80} level="M" />
                </div>
                <p className="text-xs text-gray-500">Tap "View NFC/QR setup" for programming instructions and download options.</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'Inspections' && (
          <div className="space-y-2">
            {history?.inspections.map((insp) => (
              <Link key={insp.id} to={`/inspections/${insp.id}`} className="block bg-white border border-[#e0e0e0] rounded-xl p-3 hover:border-gray-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{insp.template.name}</p>
                    <p className="text-xs text-gray-500">{new Date(insp.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <StatusBadge status={insp.status} />
                    {insp.overallResult && <StatusBadge status={insp.overallResult} />}
                  </div>
                </div>
              </Link>
            ))}
            {!history?.inspections.length && <EmptyState text="No inspections recorded" />}
          </div>
        )}

        {tab === 'Work Orders' && (
          <div className="space-y-2">
            {history?.workOrders.map((wo) => (
              <Link key={wo.id} to={`/work-orders/${wo.id}`} className="block bg-white border border-[#e0e0e0] rounded-xl p-3 hover:border-gray-300">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{wo.title}</p>
                    <p className="text-xs text-gray-500">{new Date(wo.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <StatusBadge status={wo.status} />
                    <StatusBadge status={wo.priority} />
                  </div>
                </div>
              </Link>
            ))}
            {!history?.workOrders.length && <EmptyState text="No work orders" />}
          </div>
        )}

        {tab === 'Breakdowns' && (
          <div className="space-y-2">
            {history?.breakdowns.map((bd) => (
              <div key={bd.id} className="bg-white border border-[#e0e0e0] rounded-xl p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1a1a1a]">{bd.description}</p>
                    {bd.cause && <p className="text-xs text-gray-500 mt-0.5">Cause: {bd.cause}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(bd.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    {bd.resolvedAt ? (
                      <span className="text-xs text-[#297e49] font-medium">Resolved</span>
                    ) : (
                      <span className="text-xs text-[#dc2d2f] font-medium">Active</span>
                    )}
                    {bd.durationMinutes && (
                      <p className="text-xs text-gray-400">{Math.round(bd.durationMinutes / 60)}h downtime</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!history?.breakdowns.length && <EmptyState text="No breakdowns recorded" />}
          </div>
        )}

        {tab === 'PPM' && (
          <div className="space-y-2">
            {canEdit && (
              <button onClick={() => setShowAddPPM(true)}
                className="w-full bg-[#153f26] hover:bg-[#0e2c1a] text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                + New PPM Task
              </button>
            )}
            {asset.ppmSchedules.map((ppm) => {
              const isOverdue = new Date(ppm.nextDueAt) < new Date();
              return (
                <div key={ppm.id} className={`bg-white border rounded-xl p-4 ${isOverdue ? 'border-[#f59e0b]' : 'border-[#e0e0e0]'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1a1a1a]">{ppm.taskName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ppm.frequency}</p>
                      {ppm.lastCompletedAt && (
                        <p className="text-xs text-gray-400">Last: {new Date(ppm.lastCompletedAt).toLocaleDateString('en-GB')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${isOverdue ? 'text-[#dc2d2f]' : 'text-[#297e49]'}`}>
                        {isOverdue ? 'OVERDUE' : 'Due'}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(ppm.nextDueAt).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!asset.ppmSchedules.length && <EmptyState text="No PPM schedules" />}
          </div>
        )}

        {tab === 'Templates' && (
          <div className="space-y-4">
            <AssignTemplateSection assetId={asset.id} siteId={asset.siteId} />
          </div>
        )}

        {showEditModal && (
          <EditAssetModal asset={asset} onClose={() => setShowEditModal(false)}
            onSuccess={() => qc.invalidateQueries({ queryKey: ['asset', id] })} />
        )}
        {showDuplicate && (
          <DuplicateAssetModal asset={asset} onClose={() => setShowDuplicate(false)} />
        )}
        {showAddPPM && (
          <AddAssetPPMModal assetId={asset.id} assetName={asset.name} siteId={asset.siteId}
            onClose={() => setShowAddPPM(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['asset', id] })} />
        )}

        {tab === 'NFC/QR' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">QR Code</p>
              <div className="flex items-center gap-5">
                <QRCodeSVG value={nfcUrl} size={140} level="M" />
                <div>
                  <p className="text-sm text-gray-600 mb-2">Scan to start inspection directly</p>
                  <button
                    onClick={() => {
                      const svgEl = document.getElementById('qr-download-' + asset.id);
                      if (!svgEl) return;
                      const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${asset.plantId || asset.id}-qr.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-[#297e49] hover:underline min-h-0 min-w-0"
                  >
                    Download QR Code
                  </button>
                  <div id={'qr-download-' + asset.id} className="hidden">
                    <QRCodeSVG value={nfcUrl} size={200} level="M" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">NFC Tag Setup</p>
              <div className="text-sm text-gray-600 space-y-4">
                <p>Program an NFC tag to automatically open this asset's inspection when scanned.</p>
                <div>
                  <p className="font-medium text-[#1a1a1a] mb-1">Tag URL to write:</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-[#e0e0e0] rounded-lg px-3 py-2">
                    <code className="text-xs text-gray-700 flex-1 break-all">{nfcUrl}</code>
                    <button onClick={() => navigator.clipboard.writeText(nfcUrl)}
                      className="text-xs text-[#297e49] font-medium hover:underline min-h-0 min-w-0 flex-shrink-0">Copy</button>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-[#1a1a1a] mb-2">How to program:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600">
                    <li>Install <strong>NFC Tools</strong> (Android) from the Play Store</li>
                    <li>Open NFC Tools → tap <strong>Write</strong> → <strong>Add a record</strong></li>
                    <li>Select <strong>URL/URI</strong> and paste the tag URL above</li>
                    <li>Tap <strong>Write</strong> then hold phone against NFC tag until confirmed</li>
                    <li>Test by tapping the tag — it should open this inspection in the app</li>
                  </ol>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <strong>Note:</strong> Use NTAG213, NTAG215, or NTAG216 tags. Attach to a weatherproof location on the asset using an industrial NFC tag holder.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400">{label}</span>
      <p className="font-medium text-[#1a1a1a] mt-0.5">{value}</p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-xl p-3 text-center">
      <div className="text-2xl font-bold text-[#1a1a1a]">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-10 text-gray-400 text-sm">{text}</div>
  );
}
