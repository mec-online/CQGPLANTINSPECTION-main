import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';
import StatusBadge from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import CreateWorkOrderModal from '@/components/CreateWorkOrderModal';

interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  createdAt: string;
  dueDate: string | null;
  isOverdue: boolean;
  completedAt: string | null;
  site: { name: string; code: string };
  asset: { name: string; plantId: string | null } | null;
  assignedTo: { name: string } | null;
  createdBy: { name: string };
  _count: { attachments: number };
}

const STATUS_FILTERS = ['ALL', 'OVERDUE', 'OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'VERIFIED'];

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'SITE_MANAGER' || user?.role === 'MAINTENANCE';

  const { data, isLoading } = useQuery<{ workOrders: WorkOrder[]; total: number } | WorkOrder[]>({
    queryKey: ['work-orders', statusFilter, user?.siteId],
    queryFn: () => {
      if (statusFilter === 'OVERDUE') {
        return api.get('/work-orders/overdue').then((r) => r.data);
      }
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (user?.siteId) params.set('siteId', user.siteId);
      return api.get(`/work-orders?${params}`).then((r) => r.data);
    },
  });

  // Normalise both response shapes
  const workOrders: WorkOrder[] = Array.isArray(data) ? (data as WorkOrder[]) : ((data as { workOrders: WorkOrder[] })?.workOrders ?? []);
  const total = Array.isArray(data) ? (data as WorkOrder[]).length : ((data as { total: number })?.total ?? 0);

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-[#1a1a1a]">Work Orders</h1>
            <p className="text-gray-500 text-sm mt-0.5">{total} total</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#dc2d2f] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#b52527] transition-colors flex-shrink-0"
            >
              + New WO
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-0 ${
                statusFilter === s
                  ? s === 'OVERDUE'
                    ? 'bg-[#dc2d2f] text-white'
                    : 'bg-[#1a1a1a] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !workOrders.length ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-2">🔧</p>
            <p>No work orders found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <Link
                key={wo.id}
                to={`/work-orders/${wo.id}`}
                className={`block bg-white border rounded-xl p-4 hover:border-gray-300 transition-colors ${wo.isOverdue ? 'border-[#dc2d2f] border-2' : 'border-[#e0e0e0]'}`}
              >
                <div className="flex items-start gap-3">
                  <PriorityDot priority={wo.priority} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#1a1a1a] leading-snug">{wo.title}</p>
                      {wo.isOverdue && (
                        <span className="text-xs font-semibold bg-red-100 text-[#dc2d2f] px-1.5 py-0.5 rounded">OVERDUE</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {wo.asset?.name || 'No asset'} &middot; {wo.site.code}
                    </p>
                    {wo.assignedTo && (
                      <p className="text-xs text-gray-400 mt-0.5">Assigned: {wo.assignedTo.name}</p>
                    )}
                    {wo.dueDate && (
                      <p className={`text-xs mt-0.5 ${wo.isOverdue ? 'text-[#dc2d2f] font-medium' : 'text-gray-400'}`}>
                        Due: {new Date(wo.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={wo.status} />
                    <StatusBadge status={wo.priority} />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <span className="text-xs text-gray-400">
                    {new Date(wo.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {wo._count?.attachments > 0 && (
                    <span className="text-xs text-gray-400">{wo._count.attachments} file{wo._count.attachments !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateWorkOrderModal
          siteId={user?.siteId || ''}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}
    </AppShell>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colours: Record<string, string> = {
    LOW: 'bg-gray-300',
    MEDIUM: 'bg-blue-400',
    HIGH: 'bg-orange-400',
    CRITICAL: 'bg-[#dc2d2f]',
  };
  return (
    <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${colours[priority] || 'bg-gray-300'}`} />
  );
}
