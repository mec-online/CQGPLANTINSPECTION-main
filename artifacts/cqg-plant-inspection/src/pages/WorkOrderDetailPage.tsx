import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import AuthImage from '@/components/AuthImage';
import { useAuth } from '@/context/AuthContext';

interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  verifiedAt: string | null;
  site: { name: string; code: string };
  asset: { name: string; plantId: string | null; manufacturer: string | null; model: string | null } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  createdBy: { name: string };
  verifiedBy: { name: string } | null;
  inspectionAnswer: { question: { text: string } } | null;
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number; uploadedAt: string; uploadedBy: { name: string }; previewUrl: string }>;
}

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'VERIFIED'];

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const [notes, setNotes] = useState('');

  const { data: wo, isLoading } = useQuery<WorkOrder>({
    queryKey: ['work-order', id],
    queryFn: () => api.get(`/work-orders/${id}`).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/work-orders/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }),
  });

  const completeMutation = useMutation({
    mutationFn: () => api.put(`/work-orders/${id}/complete`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      setNotes('');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => api.put(`/work-orders/${id}/verify`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('workOrderId', id!);
      await api.post('/attachments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }),
    onError: () => setUploadError('Upload failed. Please try again.'),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError('');
      uploadMutation.mutate(file);
    }
  };

  if (isLoading || !wo) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading...</div>
        </div>
      </AppShell>
    );
  }

  const canVerify = (user?.role === 'ADMIN' || user?.role === 'SITE_MANAGER') && wo.status === 'COMPLETED';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 mb-4 flex items-center gap-1 min-h-0 min-w-0 hover:text-[#1a1a1a]">
          ← Back
        </button>

        {/* Title */}
        <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1">
              <h1 className="text-base font-semibold text-[#1a1a1a] leading-snug">{wo.title}</h1>
              {wo.inspectionAnswer && (
                <p className="text-xs text-gray-500 mt-1">From: {wo.inspectionAnswer.question.text}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <StatusBadge status={wo.status} size="md" />
              <StatusBadge status={wo.priority} />
            </div>
          </div>

          {wo.description && (
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">{wo.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400">Site</span>
              <p className="font-medium mt-0.5">{wo.site.name}</p>
            </div>
            <div>
              <span className="text-gray-400">Asset</span>
              <p className="font-medium mt-0.5">{wo.asset?.name || '—'}</p>
            </div>
            <div>
              <span className="text-gray-400">Created by</span>
              <p className="font-medium mt-0.5">{wo.createdBy.name}</p>
            </div>
            <div>
              <span className="text-gray-400">Assigned to</span>
              <p className="font-medium mt-0.5">{wo.assignedTo?.name || 'Unassigned'}</p>
            </div>
            <div>
              <span className="text-gray-400">Created</span>
              <p className="font-medium mt-0.5">{new Date(wo.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            {wo.completedAt && (
              <div>
                <span className="text-gray-400">Completed</span>
                <p className="font-medium mt-0.5">{new Date(wo.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
          </div>
        </div>

        {/* Status update */}
        {wo.status !== 'VERIFIED' && (
          <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 mb-4">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-3">Update Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.filter((s) => s !== wo.status && s !== 'VERIFIED').map((s) => (
                <button
                  key={s}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                  className="px-3 py-2 border border-[#e0e0e0] rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors min-h-0"
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            {wo.status !== 'COMPLETED' && (
              <div className="mt-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Resolution notes (optional)..."
                  rows={3}
                  className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#297e49]"
                />
                <button
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  className="mt-2 w-full bg-[#297e49] hover:bg-[#1f6338] text-white rounded-xl py-3.5 font-semibold transition-colors disabled:opacity-50"
                >
                  {completeMutation.isPending ? 'Completing...' : 'Mark Complete'}
                </button>
              </div>
            )}

            {canVerify && (
              <button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="mt-3 w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl py-3.5 font-semibold transition-colors disabled:opacity-50"
              >
                Verify Completed
              </button>
            )}
          </div>
        )}

        {/* Attachments */}
        <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Photos & Attachments</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="text-sm text-[#dc2d2f] font-medium hover:underline min-h-0 min-w-0 disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Uploading...' : '+ Add photo'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {uploadError && <p className="text-[#dc2d2f] text-xs mb-3">{uploadError}</p>}

          {wo.attachments.length === 0 ? (
            <p className="text-sm text-gray-400">No attachments yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {wo.attachments.map((att) => (
                <div key={att.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  {att.mimeType.startsWith('image/') ? (
                    <AuthImage
                      src={att.previewUrl}
                      alt={att.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                      {att.filename}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
