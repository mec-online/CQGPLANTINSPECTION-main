import { useOfflineSync } from '@/context/OfflineSyncContext';

export default function OfflineBanner() {
  const { isOnline, pendingCount } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-gray-800 text-white text-xs font-medium text-center py-2 px-4 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
        <span>
          No signal — working offline.
          {pendingCount > 0 && ` ${pendingCount} answer${pendingCount !== 1 ? 's' : ''} will sync when reconnected.`}
        </span>
      </div>
    );
  }

  // Online but still have pending items syncing
  if (pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-[#297e49] text-white text-xs font-medium text-center py-2 px-4 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
        <span>Back online — syncing {pendingCount} pending answer{pendingCount !== 1 ? 's' : ''}...</span>
      </div>
    );
  }

  return null;
}
