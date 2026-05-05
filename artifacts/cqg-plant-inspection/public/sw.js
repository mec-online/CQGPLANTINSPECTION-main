// CQG Plant Inspection — Service Worker
const CACHE_NAME = 'cqg-plant-v2';
const STATIC_ASSETS = [
  '/',
  '/inspections/start',
  '/work-orders',
];

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cqg-offline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pendingAnswers')) {
        db.createObjectStore('pendingAnswers', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('inspectionCache')) {
        db.createObjectStore('inspectionCache', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToStore(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromStore(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — handle API caching and navigation offline fallback only
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Let Vite build assets (JS/CSS in /assets/) pass through — browser handles caching natively
  if (url.pathname.startsWith('/assets/')) return;

  // Cache API GET responses; pass non-GET API calls through
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') return;
    event.respondWith(
      fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(request).then((cached) =>
          cached || new Response(JSON.stringify({ error: 'Offline', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );
    return;
  }

  // Network-first for navigation — fall back to cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((cached) => cached || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }
});

// Background sync — replay pending answers when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-answers') {
    event.waitUntil(syncPendingAnswers());
  }
});

async function syncPendingAnswers() {
  const pending = await getAllFromStore('pendingAnswers');
  for (const item of pending) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: JSON.stringify(item.body),
      });
      if (res.ok) {
        await deleteFromStore('pendingAnswers', item.id);
        // Notify clients
        self.clients.matchAll().then((clients) =>
          clients.forEach((client) =>
            client.postMessage({ type: 'SYNC_COMPLETE', inspectionId: item.inspectionId })
          )
        );
      }
    } catch (_) {
      // Will retry on next sync
    }
  }
}

// Message handler — cache inspection data for offline use
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'CACHE_INSPECTION') {
    await saveToStore('inspectionCache', event.data.inspection);
  }
  if (event.data?.type === 'QUEUE_ANSWER') {
    await saveToStore('pendingAnswers', event.data.payload);
    // Request background sync
    if ('sync' in self.registration) {
      self.registration.sync.register('sync-pending-answers');
    }
  }
});
