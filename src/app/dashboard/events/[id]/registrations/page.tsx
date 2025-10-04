'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface PageParams {
  params: Promise<{ id: string }>;
}

interface RegistrationWithUser {
  id: string;
  eventId: string;
  userId: string;
  responses: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'checked-in';
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface EventDetails {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  formSchema: {
    fields: Array<{
      id: string;
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };
}

export default function PendingRegistrationsPage({ params }: PageParams) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  const router = useRouter();
  const { data: session, status } = useSession();
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<RegistrationWithUser[]>([]);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'checked-in'>('all');
  
  // Fetch event data and ALL registrations
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event details
        const eventResponse = await fetch(`/api/events/${eventId}`);
        if (!eventResponse.ok) {
          throw new Error(`Failed to fetch event: ${eventResponse.status}`);
        }
        const eventData = await eventResponse.json();
        setEvent(eventData.event);
        
        // Fetch ALL registrations for this event
        const registrationsResponse = await fetch(`/api/events/${eventId}/registrations`);
        if (!registrationsResponse.ok) {
          throw new Error(`Failed to fetch registrations: ${registrationsResponse.status}`);
        }
        const registrationsData = await registrationsResponse.json();
        setRegistrations(registrationsData.registrations || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (status !== 'loading') {
      fetchData();
    }
  }, [eventId, status]);
  
  // Filter registrations based on status
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredRegistrations(registrations);
    } else {
      setFilteredRegistrations(registrations.filter(reg => reg.status === statusFilter));
    }
  }, [registrations, statusFilter]);
  
  // Redirect if not authenticated or not organizer/admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/dashboard/events/${eventId}/registrations`);
    } else if (status === 'authenticated' && 
               session.user.role !== 'admin' && 
               session.user.role !== 'organizer') {
      router.push('/dashboard');
    }
  }, [status, session, router, eventId]);

  const handleApprove = async (registrationId: string) => {
    setProcessingId(registrationId);
    try {
      const response = await fetch('/api/events/registrations/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registrationId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve registration');
      }
      
      // Update the local state - don't remove, just update status
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { ...reg, status: 'approved' as const }
            : reg
        )
      );
    } catch (err) {
      console.error('Error approving registration:', err);
      alert(err instanceof Error ? err.message : 'Failed to approve registration');
    } finally {
      setProcessingId(null);
    }
  };
  
  const handleReject = async (registrationId: string) => {
    setProcessingId(registrationId);
    try {
      const response = await fetch('/api/events/registrations/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registrationId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject registration');
      }
      
      // Update the local state - don't remove, just update status
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { ...reg, status: 'rejected' as const }
            : reg
        )
      );
    } catch (err) {
      console.error('Error rejecting registration:', err);
      alert(err instanceof Error ? err.message : 'Failed to reject registration');
    } finally {
      setProcessingId(null);
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-medium">Error: {error || 'Event not found'}</p>
        </div>
        <Link href="/dashboard/events" className="text-indigo-600 hover:text-indigo-800">
          ← Back to all events
        </Link>
      </div>
    );
  }

  const handleExport = () => {
    // Open the export endpoint in a new window to download the CSV
    window.open(`/api/events/${eventId}/export`, '_blank');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Event Registrations</h1>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={registrations.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to CSV
          </button>
          <Link 
            href={`/dashboard/events/${eventId}`}
            className="text-indigo-600 hover:text-indigo-800 flex items-center"
          >
            ← Back to Event Details
          </Link>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">{event.name}</h2>
        <p className="text-gray-600 mb-4">
          {new Date(event.date).toLocaleDateString()} at {event.location}
        </p>
        
        {/* Status Filter */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({registrations.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pending ({registrations.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Approved ({registrations.filter(r => r.status === 'approved').length})
          </button>
          <button
            onClick={() => setStatusFilter('checked-in')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'checked-in'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Checked In ({registrations.filter(r => r.status === 'checked-in').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Rejected ({registrations.filter(r => r.status === 'rejected').length})
          </button>
        </div>
      </div>
      
      {filteredRegistrations.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-500">
            No {statusFilter === 'all' ? '' : statusFilter} registrations found.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredRegistrations.map((registration) => {
            const statusColors = {
              pending: 'bg-amber-100 text-amber-800',
              approved: 'bg-green-100 text-green-800',
              rejected: 'bg-red-100 text-red-800',
              'checked-in': 'bg-blue-100 text-blue-800'
            };
            
            return (
              <div key={registration.id} className="bg-white shadow-md rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">
                        {registration.user?.name || 'Unknown User'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[registration.status]}`}>
                        {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-gray-500">{registration.user?.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Registered on {new Date(registration.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {registration.status === 'pending' && (
                    <div className="space-x-3">
                      <button
                        onClick={() => handleApprove(registration.id)}
                        disabled={processingId === registration.id}
                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === registration.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(registration.id)}
                        disabled={processingId === registration.id}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === registration.id ? 'Processing...' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-medium mb-2">Registration Responses:</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(registration.responses).map(([key, value]) => {
                      const field = event.formSchema.fields.find(f => f.name === key);
                      const label = field?.label || key;
                      const stringValue = String(value);
                      
                      // Check if it's a Google Drive link
                      const isGoogleDriveLink = stringValue.includes('drive.google.com');
                      
                      return (
                        <div key={key} className="flex flex-col">
                          <dt className="text-gray-500 text-sm">{label}:</dt>
                          <dd className="font-medium">
                            {isGoogleDriveLink ? (
                              <a 
                                href={stringValue} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                {stringValue}
                              </a>
                            ) : (
                              stringValue
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}