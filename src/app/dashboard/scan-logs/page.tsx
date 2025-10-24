'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface FailedScan {
  id: string;
  qrCode: string | null;
  checkpoint: string;
  scanStatus: string;
  errorMessage: string | null;
  eventName: string | null;
  eventId: string | null;
  volunteerName: string | null;
  volunteerEmail: string | null;
  userName: string | null;
  userEmail: string | null;
  timestamp: string;
}

export default function ScanLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [failedScans, setFailedScans] = useState<FailedScan[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    // Only admin and organizer can access this page
    if (session?.user?.role !== 'admin' && session?.user?.role !== 'organizer') {
      router.push('/dashboard');
      return;
    }

    // Auto-fetch on mount
    fetchFailedScans();
  }, [session, status, router]);

  const fetchFailedScans = async () => {
    setLoadingScans(true);
    try {
      const response = await fetch('/api/admin/failed-scans');
      if (response.ok) {
        const data = await response.json();
        const scans = data.scans.map((scan: Record<string, string | null>) => ({
          id: scan.id || '',
          qrCode: scan.qr_code || null,
          checkpoint: scan.checkpoint || '',
          scanStatus: scan.scan_status || 'unknown',
          errorMessage: scan.error_message || null,
          eventName: scan.event_name || 'Unknown Event',
          eventId: scan.event_id || null,
          volunteerName: scan.volunteer_name || 'Unknown',
          volunteerEmail: scan.volunteer_email || '',
          userName: scan.user_name || null,
          userEmail: scan.user_email || null,
          timestamp: scan.created_at || new Date().toISOString(),
        }));
        setFailedScans(scans);
      }
    } catch (error) {
      console.error('Error fetching scan logs:', error);
    } finally {
      setLoadingScans(false);
    }
  };



  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'organizer')) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Scan Activity Logs</h1>
        <p className="text-gray-600 mt-1">
          {session.user.role === 'admin' 
            ? 'View all scan attempts across all events' 
            : 'View scan attempts for your events'}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {/* Action Buttons */}
              <button
                onClick={fetchFailedScans}
                disabled={loadingScans}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                title="Refresh scan logs"
              >
                <svg className={`w-4 h-4 ${loadingScans ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterStatus === 'all' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({failedScans.length})
              </button>
              <button
                onClick={() => setFilterStatus('success')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterStatus === 'success' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Success ({failedScans.filter(s => s.scanStatus === 'success').length})
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterStatus === 'failed' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Failed ({failedScans.filter(s => s.scanStatus !== 'success').length})
              </button>
            </div>
          </div>
        </div>
        
        {loadingScans ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading scan logs...</p>
          </div>
        ) : failedScans.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">No scan logs found</p>
            <p className="text-sm mt-1">Scan logs will appear here once volunteers start checking in participants</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Event
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Checkpoint
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Volunteer
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Details
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {failedScans
                  .filter(scan => {
                    if (filterStatus === 'all') return true;
                    if (filterStatus === 'success') return scan.scanStatus === 'success';
                    if (filterStatus === 'failed') return scan.scanStatus !== 'success';
                    return true;
                  })
                  .map((scan) => (
                  <tr key={scan.id} className={`hover:bg-gray-50 ${
                    scan.scanStatus === 'success' ? 'bg-green-50/30' : ''
                  }`}>
                    <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">
                      {new Date(scan.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <div className="max-w-[120px] truncate" title={scan.eventName || 'Unknown'}>
                        {scan.eventName || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {scan.checkpoint || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <div className="max-w-[150px]">
                        <div className="font-medium truncate" title={scan.volunteerName || 'Unknown'}>
                          {scan.volunteerName || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={scan.volunteerEmail || ''}>
                          {scan.volunteerEmail}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        scan.scanStatus === 'success' ? 'bg-green-100 text-green-800' :
                        scan.scanStatus === 'invalid_qr' ? 'bg-red-100 text-red-800' :
                        scan.scanStatus === 'not_found' ? 'bg-orange-100 text-orange-800' :
                        scan.scanStatus === 'already_checked_in' ? 'bg-yellow-100 text-yellow-800' :
                        scan.scanStatus === 'wrong_checkpoint' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {scan.scanStatus ? scan.scanStatus.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {scan.errorMessage ? (
                        <div className="max-w-[200px] text-red-600 truncate" title={scan.errorMessage}>
                          {scan.errorMessage}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      {scan.userName ? (
                        <div className="max-w-[150px]">
                          <div className="font-medium truncate" title={scan.userName}>
                            {scan.userName}
                          </div>
                          <div className="text-xs text-gray-500 truncate" title={scan.userEmail || ''}>
                            {scan.userEmail}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
