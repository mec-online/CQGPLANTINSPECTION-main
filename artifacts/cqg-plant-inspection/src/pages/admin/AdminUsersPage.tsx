import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';

interface Site { id: string; name: string; code: string; }
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  siteId: string | null;
  site: Site | null;
}

const ROLES = ['OPERATOR', 'SITE_MANAGER', 'MAINTENANCE', 'ADMIN', 'READONLY'];

const roleColour: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  SITE_MANAGER: 'bg-blue-100 text-blue-800',
  MAINTENANCE: 'bg-purple-100 text-purple-800',
  OPERATOR: 'bg-green-100 text-green-800',
  READONLY: 'bg-gray-100 text-gray-600',
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERATOR', siteId: '', isActive: true });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/admin/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof form> }) => api.put(`/admin/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); closeModal(); },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'OPERATOR', siteId: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, siteId: u.siteId || '', isActive: u.isActive });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const data: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, siteId: form.siteId || null, isActive: form.isActive };
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(form);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <AppShell>
        <div className="px-4 py-6 max-w-md mx-auto text-center">
          <p className="text-gray-500">Only administrators can manage users.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Users</h1>
          <button onClick={openCreate} className="bg-[#dc2d2f] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#b52527] transition-colors">
            Add User
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-[#e0e0e0]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Site</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]">
                {users?.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#1a1a1a]">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColour[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.site?.code || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(u)} className="text-sm text-[#dc2d2f] font-medium hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">{editing ? 'Edit User' : 'Add User'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                  <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{editing ? 'New Password (leave blank to keep)' : 'Password'}</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                    required={!editing}
                    className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                    className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Site (leave blank for group-wide)</label>
                  <select value={form.siteId} onChange={e => setForm(f => ({...f, siteId: e.target.value}))}
                    className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]">
                    <option value="">— All Sites —</option>
                    {sites?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                {editing && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({...f, isActive: e.target.checked}))}
                      className="w-4 h-4 accent-[#dc2d2f]"/>
                    <label htmlFor="isActive" className="text-sm text-[#1a1a1a]">Active</label>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal}
                    className="flex-1 border border-[#e0e0e0] text-[#1a1a1a] py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-1 bg-[#dc2d2f] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#b52527] disabled:opacity-50">
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
