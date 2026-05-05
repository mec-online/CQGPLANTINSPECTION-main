import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import QueryProvider from './components/QueryProvider';
import { AuthProvider } from './context/AuthContext';
import { GpsProvider } from './context/GpsContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration';
import OfflineBanner from './components/OfflineBanner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <GpsProvider>
            <OfflineSyncProvider>
              <ServiceWorkerRegistration />
              <OfflineBanner />
              <App />
            </OfflineSyncProvider>
          </GpsProvider>
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>,
);
