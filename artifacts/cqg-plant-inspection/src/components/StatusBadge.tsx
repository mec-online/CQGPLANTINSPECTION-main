interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, string> = {
  // Inspection results
  PASS: 'bg-green-100 text-green-800 border-green-200',
  FAIL: 'bg-red-100 text-red-800 border-red-200',
  MONITOR: 'bg-amber-100 text-amber-800 border-amber-200',
  NA: 'bg-gray-100 text-gray-600 border-gray-200',

  // Inspection status
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  ABANDONED: 'bg-gray-100 text-gray-600 border-gray-200',

  // Work order status
  OPEN: 'bg-red-100 text-red-800 border-red-200',
  WAITING_PARTS: 'bg-purple-100 text-purple-800 border-purple-200',
  VERIFIED: 'bg-green-100 text-green-800 border-green-200',

  // Priority
  LOW: 'bg-gray-100 text-gray-600 border-gray-200',
  MEDIUM: 'bg-blue-100 text-blue-800 border-blue-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  WAITING_PARTS: 'Waiting Parts',
  NA: 'N/A',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const styles = statusStyles[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  const label = statusLabels[status] || status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');

  const sizeClass = size === 'md'
    ? 'px-3 py-1 text-sm font-medium'
    : 'px-2 py-0.5 text-xs font-medium';

  return (
    <span className={`inline-flex items-center rounded border ${styles} ${sizeClass}`}>
      {label}
    </span>
  );
}
