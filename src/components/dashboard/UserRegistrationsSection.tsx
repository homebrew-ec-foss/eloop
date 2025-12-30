'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GenericQRDisplay } from '@/components/qr/GenericQRDisplay';

interface CheckpointCheckIn {
  checkpoint: string;
  checkedInBy: string;
  checkedInAt: string;
}

interface ActiveRegistration {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  qrCode: string;
  status: 'pending' | 'approved' | 'rejected' | 'checked-in';
  checkpointCheckIns: CheckpointCheckIn[];
}

interface StatusData {
  hasRegistration: boolean;
  registration?: ActiveRegistration;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function UserRegistrationsSection({ viewAsUserId }: { viewAsUserId?: string }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const endpoint = viewAsUserId ? `/api/admin/view-as?userId=${encodeURIComponent(viewAsUserId)}` : '/api/users/me/status';
        const response = await fetch(endpoint);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `Failed to fetch status: ${response.status}`;
          console.error('Status fetch failed:', errorMessage);
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setStatusData(data);
      } catch (err) {
        console.error('Error fetching status:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    // If viewing as another user, allow admins to fetch; otherwise only fetch when session exists
    if ((viewAsUserId && session?.user?.role === 'admin') || (!viewAsUserId && session?.user)) {
      fetchStatus();
    }
  }, [session, searchParams, viewAsUserId]);

  // Auto-logout applicants who have been approved (so they can login as participant)
  useEffect(() => {
    if (statusData?.registration &&
      session?.user?.role === 'applicant' &&
      statusData.registration.status === 'approved') {
      signOut({ callbackUrl: '/auth/signin?message=Your registration has been approved! Please sign in again to access participant features.' });
    }
  }, [statusData, session?.user?.role]);

  if (!session?.user) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!statusData?.hasRegistration || !statusData.registration) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Your Registration Status</h3>
        <p className="text-gray-500 mb-4">You don&apos;t have any active registrations yet.</p>
        <Link
          href="/dashboard/events"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Browse Events
        </Link>
      </div>
    );
  }

  const { registration } = statusData;
  const latestCheckIn = registration.checkpointCheckIns.length > 0
    ? registration.checkpointCheckIns[registration.checkpointCheckIns.length - 1]
    : null;

  // Don't render anything for applicants with approved registrations - they'll be logged out
  if (session?.user?.role === 'applicant' &&
    registration.status === 'approved') {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-6">

      {/* QR Code Display - stacked and centered */}
      {(session.user.role === 'participant' || viewAsUserId) && (
        <div className="w-full max-w-[420px]">
          <GenericQRDisplay
            qrData={registration.qrCode}
            title="Your Check-in QR Code"
            description="Show this to event staff at checkpoints"
            showDownload={true}
            userName={statusData?.user.name}
            eventName={registration.eventName}
          />
        </div>
      )}

      {/* Checkpoint Status (stacked below the ticket) */}
      <div className="w-full max-w-[480px]">
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Checkpoint Status</h4>
          {registration.status === 'pending' && (
            <>
              <div className="inline-flex items-center px-4 py-2 rounded-lg text-base font-medium bg-yellow-100 text-yellow-800">
                ⏳ Pending Approval
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Your registration has been submitted successfully. The organizer will review your application and approve it soon. You&apos;ll be able to access your check-in QR code after approval.
              </p>
            </>
          )}
          {registration.status === 'approved' && !latestCheckIn && (
            <div className="inline-flex items-center px-4 py-2 rounded-lg text-base font-medium bg-green-100 text-green-800">
              ⌛ Not Checked In Yet
            </div>
          )}
          {registration.status === 'rejected' && (
            <div className="inline-flex items-center px-4 py-2 rounded-lg text-base font-medium bg-red-100 text-red-800">
              ✗ Not Approved
            </div>
          )}
          {(registration.status === 'checked-in' || latestCheckIn) && (
            <div className="inline-flex items-center px-4 py-2 rounded-lg text-base font-medium bg-blue-100 text-blue-800">
              ✓ Checked In at {latestCheckIn?.checkpoint}
            </div>
          )}
        </div>

        {/* Checkpoint Check-ins List */}
        {registration.checkpointCheckIns.length > 0 && (
          <div className="mt-6 w-full">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Checkpoint History</h4>
            <div className="space-y-3">
              {[...registration.checkpointCheckIns].reverse().map((checkIn, index) => (
                <div
                  key={index}
                  className="flex items-start p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {registration.checkpointCheckIns.length - index}
                    </div>
                  </div>
                  <div className="ml-4 flex-grow">
                    <h5 className="font-semibold text-gray-900">{checkIn.checkpoint}</h5>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(checkIn.checkedInAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}