import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';

interface Setting { key: string; value: unknown; updatedAt: string; }

const SETTING_DESCRIPTIONS: Record<string, string> = {
  'priorities': 'Work order priority levels',
  'work_order_statuses': 'Work order status options',
  'breakdown_causes': 'Common breakdown cause categories',
  'ppm_frequencies': 'PPM schedule frequency options',
  'inspection_types': 'Inspection template types',
};

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [jsonError, setJsonError] = useState('');

  const { data: settings, isLoading } = useQuery<Setting[]>({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api.put(`/admin/settings/${key}`, { value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); setEditing(null); },
  });

  const startEdit = (setting: Setting) => {
    setEditing(setting.key);
    setEditValue(JSON.stringify(setting.value, null, 2));
    setJsonError('');
  };

  const saveEdit = () => {
    try {
      const parsed = JSON.parse(editValue);
      setJsonError('');
      updateMutation.mutate({ key: editing!, value: parsed });
    } catch {
      setJsonError('Invalid JSON — please fix before saving.');
    }
  };

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">App Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Configure dropdown options and system-wide values.</p>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="space-y-4">
            {settings?.map(setting => (
              <div key={setting.key} className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-[#e0e0e0]">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">{setting.key}</p>
                    {SETTING_DESCRIPTIONS[setting.key] && (
                      <p className="text-xs text-gray-500">{SETTING_DESCRIPTIONS[setting.key]}</p>
                    )}
                  </div>
                  {editing !== setting.key && (
                    <button onClick={() => startEdit(setting)}
                      className="text-sm text-[#dc2d2f] font-medium hover:underline">
                      Edit
                    </button>
                  )}
                </div>

                {editing === setting.key ? (
                  <div className="p-4">
                    <textarea
                      value={editValue}
                      onChange={e => { setEditValue(e.target.value); setJsonError(''); }}
                      rows={8}
                      spellCheck={false}
                      className="w-full font-mono text-xs border border-[#e0e0e0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#dc2d2f] resize-y"
                    />
                    {jsonError && <p className="text-xs text-[#dc2d2f] mt-1">{jsonError}</p>}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setEditing(null)}
                        className="flex-1 border border-[#e0e0e0] text-[#1a1a1a] py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                        Cancel
                      </button>
                      <button onClick={saveEdit} disabled={updateMutation.isPending}
                        className="flex-1 bg-[#dc2d2f] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#b52527] disabled:opacity-50">
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <pre className="text-xs text-gray-600 overflow-x-auto">{JSON.stringify(setting.value, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
            {!settings?.length && (
              <div className="text-center py-12 text-gray-400">No settings configured.</div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
