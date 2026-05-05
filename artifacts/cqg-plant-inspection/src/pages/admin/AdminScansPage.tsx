import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import AppShell from '@/components/AppShell';

interface Scan {
  id: string;
  scannedAt: string;
  method: 'QR' | 'NFC';
  lat: number | null;
  lng: number | null;
  asset: { id: string; name: string; plantId: string | null; site: { name: string; code: string } };
  scannedBy: { id: string; name: string };
}

export default function AdminScansPage() {
  const { data, isLoading } = useQuery<{ scans: Scan[]; total: number }>({
    queryKey: ['scan-log'],
    queryFn: () => api.get('/asset-scans?limit=200').then(r => r.data),
  });

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Scan Audit Log</h1>
          <p className="text-gray-500 text-sm mt-1">All NFC and QR code asset scans</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
        ) : data?.scans.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No scans recorded yet</div>
        ) : (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-[#e0e0e0]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Asset</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Site</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Scanned By</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Method</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]">
                {data?.scans.map(scan => (
                  <tr key={scan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1a1a1a]">{scan.asset.name}</p>
                      {scan.asset.plantId && <p className="text-xs text-gray-400">{scan.asset.plantId}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{scan.asset.site.code}</td>
                    <td className="px-4 py-3 text-gray-600">{scan.scannedBy.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${scan.method === 'NFC' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {scan.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(scan.scannedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {scan.lat != null && scan.lng != null ? `${scan.lat.toFixed(4)}, ${scan.lng.toFixed(4)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-[#e0e0e0] text-xs text-gray-400">
              {data?.total} total scan{data?.total !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
