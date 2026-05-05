import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

interface OfflineSyncContextValue {
  isOnline: boolean;
  pendingCount: number;
  queueAnswer: (payload: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
    inspectionId: string;
  }) => void;
  refreshPendingCount: () => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  isOnline: true,
  pendingCount: 0,
  queueAnswer: () => {},
  refreshPendingCount: () => {},
});

export function useOfflineSync() {
  return useContext(OfflineSyncContext);
}

function readPendingCount(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('cqg-offline', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pendingAnswers')) { resolve(0); return; }
        const tx = db.transaction('pendingAnswers', 'readonly');
        const countReq = tx.objectStore('pendingAnswers').count();
        countReq.onsuccess = () => resolve(countReq.result as number);
        countReq.onerror = () => resolve(0);
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    readPendingCount().then(setPendingCount);
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingCount();
      // Ask SW to flush the queue
      navigator.serviceWorker?.controller?.postMessage({ type: 'FLUSH_QUEUE' });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        refreshPendingCount();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [refreshPendingCount]);

  const queueAnswer = useCallback((payload: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
    inspectionId: string;
  }) => {
    navigator.serviceWorker?.controller?.postMessage({
      type: 'QUEUE_ANSWER',
      payload,
    });
    setPendingCount((n) => n + 1);
  }, []);

  return (
    <OfflineSyncContext.Provider value={{ isOnline, pendingCount, queueAnswer, refreshPendingCount }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}
