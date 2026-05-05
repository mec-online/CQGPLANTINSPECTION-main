import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Periodically check for SW updates
        reg.update();
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  }, []);

  return null;
}
