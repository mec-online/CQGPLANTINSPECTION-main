import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface CreateWorkOrderModalProps {
  initialTitle?: string;
  initialDescription?: string;
  initialPriority?: string;
  siteId: string;
  assetId?: string | null;
  inspectionId?: string | null;
  inspectionAnswerId?: string | null;
  onClose: () => void;
  onSuccess?: (id: string) => void;
}

export default function CreateWorkOrderModal({
  initialTitle = '',
  initialDescription = '',
  initialPriority = 'MEDIUM',
  siteId,
  assetId,
  inspectionId,
  inspectionAnswerId,
  onClose,
  onSuccess,
}: CreateWorkOrderModalProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [priority, setPriority] = useState(initialPriority);
  const [dueDate, setDueDate] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/work-orders', {
      title,
      description,
      priority,
      siteId,
      assetId: assetId || null,
      inspectionId: inspectionId || null,
      inspectionAnswerId: inspectionAnswerId || null,
      dueDate: dueDate || null,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      onSuccess?.(res.data.id);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Create Work Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none min-h-0 min-w-0">&times;</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#dc2d2f]"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-[#e0e0e0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#dc2d2f]"/>
            </div>
          </div>
          {mutation.isError && <p className="text-xs text-[#dc2d2f]">Failed to create work order</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#e0e0e0] py-2.5 rounded-lg text-sm font-medium text-[#1a1a1a] hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-[#dc2d2f] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#b52527] disabled:opacity-50">
              {mutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
