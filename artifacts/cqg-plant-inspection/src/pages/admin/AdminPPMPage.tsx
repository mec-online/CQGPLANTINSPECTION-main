import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface Site { id: string; name: string; code: string }
interface Asset { id: string; name: string; plantId: string | null; site: { id: string; name: string; code: string } }
interface Template { id: string; name: string; type: string }
interface PPMSchedule {
  id: string;
  taskName: string;
  description: string | null;
  frequency: string;
  nextDueAt: string;
  lastCompletedAt: string | null;
  notes: string | null;
  template: { id: string; name: string; type: string } | null;
  asset: Asset;
  completions: Array<{ id: string; completedAt: string; notes: string | null; completedBy: { name: string } }>;
}

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
const FREQ_LABEL: Record<string, string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUAL: 'Annual',
};
const FREQ_COLOUR: Record<string, string> = {
  DAILY: 'bg-red-100 text-red-800',
  WEEKLY: 'bg-amber-100 text-amber-800',
  MONTHLY: 'bg-blue-100 text-blue-800',
  QUARTERLY: 'bg-purple-100 text-purple-800',
  ANNUAL: 'bg-gray-100 text-gray-600',
};
const TEMPLATE_TYPE_LABEL: Record<string, string> = {
  PRESTART: 'Pre-Start', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly',
  PRE_MOVEMENT: 'Pre-Movement', POST_MOVEMENT: 'Post-Movement',
};

function isDue(nextDueAt: string) { return new Date(nextDueAt) <= new Date(); }
function isOverdue(nextDueAt: string) {
  const d = new Date(nextDueAt);
  d.setDate(d.getDate() - 1);
  return d < new Date();
}
function toLocalDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

interface PPMFormProps {
  ppm?: PPMSchedule;
  onClose: () => void;
}

function PPMFormModal({ ppm, onClose }: PPMFormProps) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [siteId, setSiteId] = useState(ppm?.asset.site.id || user?.siteId || '');
  const [assetId, setAssetId] = useState(ppm?.asset.id || '');
  const [templateId, setTemplateId] = useState(ppm?.template?.id || '');
  const [taskName, setTaskName] = useState(ppm?.taskName || '');
  const [description, setDescription] = useState(ppm?.description || '');
  const [frequency, setFrequency] = useState(ppm?.frequency || 'MONTHLY');
  const [nextDueAt, setNextDueAt] = useState(
    ppm ? toLocalDateInput(new Date(ppm.nextDueAt)) : toLocalDateInput(new Date())
  );
  const [notes, setNotes] = useState(ppm?.notes || '');

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  });

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['assets', siteId],
    queryFn: () => api.get(`/assets${siteId ? `?siteId=${siteId}` : ''}`).then(r => r.data.assets),
    enabled: true,
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body = { assetId, templateId: templateId || null, taskName, description: description || null, frequency, nextDueAt: new Date(nextDueAt).toISOString(), notes: notes || null };
      return ppm ? api.put(`/ppm/${ppm.id}`, body) : api.post('/ppm', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ppm'] });
      onClose();
    },
  });

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
          <h2 className="font-semibold text-[#1a1a1a] text-lg">{ppm ? 'Edit PPM Task' : 'New PPM Task'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Site (admin only — site managers auto-scoped) */}
          {isAdmin && !ppm && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Site</label>
              <select value={siteId} onChange={e => { setSiteId(e.target.value); setAssetId(''); }}
                className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#297e49]">
                <option value="">All sites</option>
                {sites?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          )}

          {/* Asset */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Asset *</label>
            <select value={assetId} onChange={e => setAssetId(e.target.value)} required
              disabled={!!ppm}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#297e49] disabled:bg-gray-50">
              <option value="">Select asset...</option>
              {assets?.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.plantId ? ` (${a.plantId})` : ''} — {a.site.code}
                </option>
              ))}
            </select>
          </div>

          {/* Task name */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Task Name *</label>
            <input
              type="text"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              placeholder="e.g. Yearly screen mat change"
              required
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#297e49]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Description / Instructions</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Detailed instructions for carrying out this task..."
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base resize-none focus:outline-none focus:border-[#297e49]"
            />
          </div>

          {/* Linked template */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Inspection Template (optional)</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base bg-white focus:outline-none focus:border-[#297e49]">
              <option value="">No template — mark done only</option>
              {templates?.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} [{TEMPLATE_TYPE_LABEL[t.type] || t.type}]
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              When linked, an "Inspect" button will appear to run the checklist.
            </p>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Frequency *</label>
            <div className="grid grid-cols-5 gap-2">
              {FREQUENCIES.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                    frequency === f
                      ? 'bg-[#153f26] border-[#153f26] text-white'
                      : 'bg-white border-[#e0e0e0] text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {FREQ_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Next due date */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Next Due Date *</label>
            <input
              type="date"
              value={nextDueAt}
              onChange={e => setNextDueAt(e.target.value)}
              required
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#297e49]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-base resize-none focus:outline-none focus:border-[#297e49]"
            />
          </div>

          {mutation.isError && (
            <p className="text-[#dc2d2f] text-sm">Failed to save. Please try again.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#e0e0e0] flex gap-3">
          <button onClick={onClose} className="flex-1 border border-[#e0e0e0] text-[#1a1a1a] font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!assetId || !taskName || !frequency || !nextDueAt || mutation.isPending}
            className="flex-1 bg-[#153f26] hover:bg-[#0e2c1a] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {mutation.isPending ? 'Saving...' : ppm ? 'Save Changes' : 'Create PPM Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPPMPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingPPM, setEditingPPM] = useState<PPMSchedule | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [filter, setFilter] = useState<'all' | 'due' | 'overdue'>('all');

  const canManage = user?.role === 'ADMIN' || user?.role === 'SITE_MANAGER';

  const { data: ppms, isLoading } = useQuery<PPMSchedule[]>({
    queryKey: ['ppm'],
    queryFn: () => api.get('/ppm').then(r => r.data),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.post(`/ppm/${id}/complete`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ppm'] });
      setCompletingId(null);
      setCompletionNotes('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ppm/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ppm'] }),
  });

  const sorted = ppms?.slice().sort((a, b) =>
    new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime()
  );

  const filtered = sorted?.filter(p => {
    if (filter === 'overdue') return isOverdue(p.nextDueAt);
    if (filter === 'due') return isDue(p.nextDueAt);
    return true;
  });

  const overdueCount = sorted?.filter(p => isOverdue(p.nextDueAt)).length || 0;
  const dueCount = sorted?.filter(p => isDue(p.nextDueAt) && !isOverdue(p.nextDueAt)).length || 0;

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#1a1a1a]">PPM Schedules</h1>
            <p className="text-gray-500 text-sm mt-0.5">Planned preventive maintenance tasks</p>
          </div>
          {canManage && (
            <button
              onClick={() => { setEditingPPM(null); setShowForm(true); }}
              className="bg-[#153f26] hover:bg-[#0e2c1a] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              + New PPM Task
            </button>
          )}
        </div>

        {/* Summary pills */}
        {!!sorted?.length && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-[#1a1a1a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              All ({sorted.length})
            </button>
            {overdueCount > 0 && (
              <button onClick={() => setFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'overdue' ? 'bg-[#dc2d2f] text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                Overdue ({overdueCount})
              </button>
            )}
            {dueCount > 0 && (
              <button onClick={() => setFilter('due')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'due' ? 'bg-[#f59e0b] text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                Due Now ({dueCount})
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="space-y-3">
            {filtered?.map(ppm => {
              const overdue = isOverdue(ppm.nextDueAt);
              const due = isDue(ppm.nextDueAt);
              return (
                <div key={ppm.id}
                  className={`bg-white border-2 rounded-xl p-4 ${overdue ? 'border-[#dc2d2f]' : due ? 'border-[#f59e0b]' : 'border-[#e0e0e0]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FREQ_COLOUR[ppm.frequency] || 'bg-gray-100 text-gray-600'}`}>
                          {FREQ_LABEL[ppm.frequency]}
                        </span>
                        {ppm.template && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {TEMPLATE_TYPE_LABEL[ppm.template.type] || ppm.template.type}
                          </span>
                        )}
                        {overdue && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">OVERDUE</span>}
                        {due && !overdue && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">DUE</span>}
                      </div>

                      <p className="text-sm font-semibold text-[#1a1a1a] leading-snug">{ppm.taskName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ppm.asset.site.code} · {ppm.asset.name}
                        {ppm.asset.plantId && ` (${ppm.asset.plantId})`}
                      </p>

                      {ppm.description && (
                        <p className="text-xs text-gray-600 mt-1 leading-snug">{ppm.description}</p>
                      )}

                      {ppm.template && (
                        <p className="text-xs text-gray-400 mt-0.5">Template: {ppm.template.name}</p>
                      )}

                      <p className="text-xs text-gray-500 mt-1">
                        Due: <span className={overdue ? 'text-[#dc2d2f] font-medium' : due ? 'text-[#f59e0b] font-medium' : ''}>
                          {new Date(ppm.nextDueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {ppm.lastCompletedAt && ` · Last: ${new Date(ppm.lastCompletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>

                      {ppm.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{ppm.notes}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {ppm.template ? (
                        <Link
                          to={`/inspections/start?assetId=${ppm.asset.id}&siteId=${ppm.asset.site.id}&templateId=${ppm.template.id}`}
                          className="border border-[#297e49] text-[#297e49] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-50 transition-colors text-center min-h-[36px] flex items-center"
                        >
                          Inspect
                        </Link>
                      ) : (
                        <button
                          onClick={() => { setCompletingId(ppm.id); setCompletionNotes(''); }}
                          className="bg-[#297e49] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#1f6338] transition-colors min-h-[36px]">
                          Mark Done
                        </button>
                      )}
                      {ppm.template && (
                        <button
                          onClick={() => { setCompletingId(ppm.id); setCompletionNotes(''); }}
                          className="border border-[#297e49] text-[#297e49] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-50 transition-colors min-h-[36px]">
                          Mark Done
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button
                            onClick={() => { setEditingPPM(ppm); setShowForm(true); }}
                            className="border border-[#e0e0e0] text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors min-h-[36px]">
                            Edit
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this PPM task?')) deleteMutation.mutate(ppm.id); }}
                            className="border border-red-200 text-red-500 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-50 transition-colors min-h-[36px]">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Recent completions */}
                  {ppm.completions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                      <p className="text-xs text-gray-400 mb-1">Recent completions</p>
                      <div className="space-y-0.5">
                        {ppm.completions.map(c => (
                          <p key={c.id} className="text-xs text-gray-500">
                            {new Date(c.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} — {c.completedBy.name}
                            {c.notes && <span className="text-gray-400"> · {c.notes}</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline completion form */}
                  {completingId === ppm.id && (
                    <div className="mt-3 pt-3 border-t border-[#e0e0e0]">
                      <textarea
                        value={completionNotes}
                        onChange={e => setCompletionNotes(e.target.value)}
                        placeholder="Completion notes (optional)..."
                        rows={2}
                        className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#297e49] mb-2"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setCompletingId(null)}
                          className="flex-1 border border-[#e0e0e0] text-[#1a1a1a] py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                          Cancel
                        </button>
                        <button
                          onClick={() => completeMutation.mutate({ id: ppm.id, notes: completionNotes })}
                          disabled={completeMutation.isPending}
                          className="flex-1 bg-[#297e49] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#1f6338] disabled:opacity-50">
                          {completeMutation.isPending ? 'Saving...' : 'Confirm Complete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!filtered?.length && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📅</div>
                <p className="font-medium">No PPM schedules found</p>
                {canManage && (
                  <button onClick={() => { setEditingPPM(null); setShowForm(true); }}
                    className="mt-4 text-sm text-[#297e49] font-medium hover:underline">
                    Create your first PPM task
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {(showForm || editingPPM) && (
        <PPMFormModal
          ppm={editingPPM || undefined}
          onClose={() => { setShowForm(false); setEditingPPM(null); }}
        />
      )}
    </AppShell>
  );
}
