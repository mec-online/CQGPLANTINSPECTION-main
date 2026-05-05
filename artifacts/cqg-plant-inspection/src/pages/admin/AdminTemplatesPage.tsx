import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';

interface Question { id?: string; text: string; order: number; helpText: string; requiresEvidenceOnFail: boolean; allowMonitor: boolean; }
interface Section { id?: string; title: string; order: number; questions: Question[]; }
interface Template { id: string; name: string; type: string; isActive: boolean; siteId: string | null; sections: Section[]; }
interface Site { id: string; name: string; code: string; }

const TEMPLATE_TYPES = ['PRESTART', 'DAILY', 'WEEKLY', 'MONTHLY', 'PRE_MOVEMENT', 'POST_MOVEMENT'];

function emptyQuestion(order: number): Question {
  return { text: '', order, helpText: '', requiresEvidenceOnFail: false, allowMonitor: true };
}

function emptySection(order: number): Section {
  return { title: '', order, questions: [emptyQuestion(1)] };
}

export default function AdminTemplatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('PRESTART');
  const [siteId, setSiteId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<Section[]>([emptySection(1)]);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
    enabled: user?.role === 'ADMIN',
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.post('/templates', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); closeBuilder(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.put(`/templates/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); closeBuilder(); },
  });

  const closeBuilder = () => {
    setShowBuilder(false); setEditingId(null); setName(''); setType('PRESTART');
    setSiteId(''); setIsActive(true); setSections([emptySection(1)]);
  };

  const openCreate = () => {
    setEditingId(null); setName(''); setType('PRESTART'); setSiteId('');
    setIsActive(true); setSections([emptySection(1)]); setShowBuilder(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id); setName(t.name); setType(t.type); setSiteId(t.siteId || '');
    setIsActive(t.isActive);
    setSections(t.sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, helpText: q.helpText || '' })) })));
    setShowBuilder(true);
  };

  const addSection = () => setSections(ss => [...ss, emptySection(ss.length + 1)]);
  const removeSection = (si: number) => setSections(ss => ss.filter((_, i) => i !== si).map((s, i) => ({ ...s, order: i + 1 })));
  const updateSection = (si: number, title: string) => setSections(ss => ss.map((s, i) => i === si ? { ...s, title } : s));
  const addQuestion = (si: number) => setSections(ss => ss.map((s, i) => i === si ? { ...s, questions: [...s.questions, emptyQuestion(s.questions.length + 1)] } : s));
  const removeQuestion = (si: number, qi: number) => setSections(ss => ss.map((s, i) => i === si ? { ...s, questions: s.questions.filter((_, j) => j !== qi).map((q, j) => ({ ...q, order: j + 1 })) } : s));
  const updateQuestion = (si: number, qi: number, patch: Partial<Question>) => setSections(ss => ss.map((s, i) => i === si ? { ...s, questions: s.questions.map((q, j) => j === qi ? { ...q, ...patch } : q) } : s));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, type, siteId: siteId || null, isActive, sections };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Inspection Templates</h1>
          <button onClick={openCreate} className="bg-[#dc2d2f] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#b52527]">
            New Template
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="space-y-3">
            {templates?.map(t => (
              <div key={t.id} className="bg-white border border-[#e0e0e0] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.type} · {t.sections.length} section{t.sections.length !== 1 ? 's' : ''} ·{' '}
                    {t.sections.reduce((n, s) => n + s.questions.length, 0)} questions ·{' '}
                    {t.siteId ? 'Site-specific' : 'Group-wide'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => openEdit(t)} className="text-sm text-[#dc2d2f] font-medium hover:underline">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showBuilder && (
          <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-4 py-8">
              <div className="bg-white rounded-2xl w-full max-w-2xl">
                <div className="px-6 py-4 border-b border-[#e0e0e0] flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#1a1a1a]">{editingId ? 'Edit Template' : 'New Template'}</h2>
                  <button onClick={closeBuilder} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Template Name</label>
                      <input required value={name} onChange={e => setName(e.target.value)}
                        className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <select value={type} onChange={e => setType(e.target.value)}
                        className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]">
                        {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {user?.role === 'ADMIN' ? (
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Site (leave blank for group-wide)</label>
                        <select value={siteId} onChange={e => setSiteId(e.target.value)}
                          className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]">
                          <option value="">— Group-wide —</option>
                          {sites?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Scope</label>
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5 border border-[#e0e0e0]">Site-specific (your site)</p>
                      </div>
                    )}
                    {editingId && (
                      <div className="col-span-2 flex items-center gap-2">
                        <input type="checkbox" id="tplIsActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#dc2d2f]"/>
                        <label htmlFor="tplIsActive" className="text-sm text-[#1a1a1a]">Active</label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#1a1a1a]">Sections</h3>
                      <button type="button" onClick={addSection} className="text-sm text-[#dc2d2f] font-medium hover:underline">+ Add Section</button>
                    </div>

                    {sections.map((sec, si) => (
                      <div key={si} className="border border-[#e0e0e0] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-medium text-gray-400 w-6 text-center">{si + 1}</span>
                          <input required value={sec.title} onChange={e => updateSection(si, e.target.value)}
                            placeholder="Section title..."
                            className="flex-1 border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#dc2d2f]"/>
                          {sections.length > 1 && (
                            <button type="button" onClick={() => removeSection(si)}
                              className="text-gray-400 hover:text-[#dc2d2f] text-lg leading-none">×</button>
                          )}
                        </div>

                        <div className="space-y-3 pl-8">
                          {sec.questions.map((q, qi) => (
                            <div key={qi} className="border border-[#e0e0e0] rounded-lg p-3">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-xs text-gray-400 mt-2.5 w-4 text-center">{qi + 1}</span>
                                <textarea required value={q.text} onChange={e => updateQuestion(si, qi, { text: e.target.value })}
                                  placeholder="Question text..." rows={2}
                                  className="flex-1 border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#dc2d2f]"/>
                                {sec.questions.length > 1 && (
                                  <button type="button" onClick={() => removeQuestion(si, qi)}
                                    className="text-gray-400 hover:text-[#dc2d2f] text-lg leading-none mt-1">×</button>
                                )}
                              </div>
                              <input value={q.helpText} onChange={e => updateQuestion(si, qi, { helpText: e.target.value })}
                                placeholder="Help text (optional)..."
                                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#dc2d2f] mb-2"/>
                              <div className="flex gap-4 flex-wrap">
                                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                  <input type="checkbox" checked={q.allowMonitor} onChange={e => updateQuestion(si, qi, { allowMonitor: e.target.checked })} className="accent-[#f59e0b]"/>
                                  Allow MONITOR
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                  <input type="checkbox" checked={q.requiresEvidenceOnFail} onChange={e => updateQuestion(si, qi, { requiresEvidenceOnFail: e.target.checked })} className="accent-[#dc2d2f]"/>
                                  Requires photo on FAIL
                                </label>
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={() => addQuestion(si)}
                            className="text-xs text-[#dc2d2f] font-medium hover:underline">+ Add Question</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-[#e0e0e0]">
                    <button type="button" onClick={closeBuilder}
                      className="flex-1 border border-[#e0e0e0] text-[#1a1a1a] py-3 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                      className="flex-1 bg-[#dc2d2f] text-white py-3 rounded-lg text-sm font-semibold hover:bg-[#b52527] disabled:opacity-50">
                      {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Create Template'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
