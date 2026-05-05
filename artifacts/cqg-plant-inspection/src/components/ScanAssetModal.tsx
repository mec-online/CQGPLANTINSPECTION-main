import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

interface ScanAssetModalProps {
  onClose: () => void;
}

// QR code format we write: cqg-plant://asset?id=ASSET_ID&site=SITE_ID
function parseAssetQr(text: string): { assetId: string; siteId?: string } | null {
  try {
    if (text.startsWith('cqg-plant://asset')) {
      const url = new URL(text.replace('cqg-plant://', 'https://'));
      const assetId = url.searchParams.get('id');
      const siteId = url.searchParams.get('site') ?? undefined;
      if (assetId) return { assetId, siteId };
    }
    // Fallback: plain asset ID
    if (text.length > 5 && !text.includes(' ')) return { assetId: text };
  } catch {
    // ignore
  }
  return null;
}

export default function ScanAssetModal({ onClose }: ScanAssetModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'menu' | 'qr' | 'nfc'>('menu');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);

  const logScan = async (assetId: string, method: 'QR' | 'NFC') => {
    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { timeout: 3000 }
        );
      });
      await api.post('/asset-scans', {
        assetId,
        method,
        lat: pos?.coords.latitude ?? null,
        lng: pos?.coords.longitude ?? null,
        deviceInfo: navigator.userAgent.slice(0, 200),
      });
    } catch {
      // Non-blocking — don't prevent navigation if logging fails
    }
  };

  const handleScannedValue = async (value: string, method: 'QR' | 'NFC') => {
    const parsed = parseAssetQr(value);
    if (!parsed) {
      setError(`Unrecognised code: ${value}`);
      return;
    }
    await logScan(parsed.assetId, method);
    const params = new URLSearchParams({ assetId: parsed.assetId });
    if (parsed.siteId) params.set('siteId', parsed.siteId);
    onClose();
    navigate(`/inspections/start?${params.toString()}`);
  };

  // Start QR scanner
  useEffect(() => {
    if (mode !== 'qr') return;

    let stopped = false;

    async function startQr() {
      if (!qrRef.current) return;
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        setScanning(true);
        setError('');

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => {
            if (!stopped) {
              stopped = true;
              scanner.stop().catch(() => {});
              handleScannedValue(text, 'QR');
            }
          },
          () => {} // ignore frame errors
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Camera not available');
        setScanning(false);
      }
    }

    startQr();

    return () => {
      stopped = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Start NFC scan
  useEffect(() => {
    if (mode !== 'nfc') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NDEFReader = (window as any).NDEFReader;
    if (!NDEFReader) {
      setError('NFC is not supported on this device or browser. Use QR code instead.');
      return;
    }

    const abort = new AbortController();
    nfcAbortRef.current = abort;

    async function startNfc() {
      try {
        const reader = new NDEFReader();
        setScanning(true);
        setError('');
        await reader.scan({ signal: abort.signal });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reader.onreading = (event: any) => {
          for (const record of event.message.records) {
            if (record.recordType === 'url' || record.recordType === 'text') {
              const decoder = new TextDecoder();
              const text = decoder.decode(record.data);
              handleScannedValue(text, 'NFC');
              abort.abort();
              return;
            }
          }
          setError('NFC tag found but no readable URL. Please reprogram the tag.');
        };
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'NFC scan failed');
        }
        setScanning(false);
      }
    }

    startNfc();

    return () => {
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e0]">
          <h2 className="font-semibold text-[#1a1a1a] text-lg">
            {mode === 'menu' ? 'Scan Asset' : mode === 'qr' ? 'Scan QR Code' : 'NFC Tap'}
          </h2>
          <button
            onClick={mode === 'menu' ? onClose : () => { setMode('menu'); setError(''); setScanning(false); }}
            className="text-gray-400 hover:text-gray-600 min-h-0 min-w-0 p-1"
          >
            {mode === 'menu' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <span className="text-sm">&larr; Back</span>
            )}
          </button>
        </div>

        <div className="p-5">
          {mode === 'menu' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">
                Scan an asset's QR code or tap an NFC tag to start an inspection.
              </p>

              <button
                onClick={() => setMode('qr')}
                className="w-full flex items-center gap-4 border-2 border-[#e0e0e0] hover:border-[#297e49] rounded-xl p-4 transition-colors text-left"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  📷
                </div>
                <div>
                  <div className="font-semibold text-[#1a1a1a]">Scan QR Code</div>
                  <div className="text-xs text-gray-500">Use camera to scan asset QR code</div>
                </div>
              </button>

              <button
                onClick={() => setMode('nfc')}
                className="w-full flex items-center gap-4 border-2 border-[#e0e0e0] hover:border-[#297e49] rounded-xl p-4 transition-colors text-left"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  📡
                </div>
                <div>
                  <div className="font-semibold text-[#1a1a1a]">Tap NFC Tag</div>
                  <div className="text-xs text-gray-500">Hold phone near asset NFC tag</div>
                </div>
              </button>
            </div>
          )}

          {mode === 'qr' && (
            <div>
              <div id="qr-reader" ref={qrRef} className="w-full rounded-xl overflow-hidden bg-black min-h-[280px]" />
              {scanning && !error && (
                <p className="text-xs text-center text-gray-500 mt-3">Point camera at QR code...</p>
              )}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}
            </div>
          )}

          {mode === 'nfc' && (
            <div className="text-center py-8">
              {!error ? (
                <>
                  <div className="text-6xl mb-4 animate-pulse">📡</div>
                  <p className="font-medium text-[#1a1a1a] mb-1">Ready to scan</p>
                  <p className="text-sm text-gray-500">Hold your phone near the NFC tag on the asset</p>
                </>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-left">{error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
