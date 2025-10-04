'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useRefreshSession } from '@/lib/hooks/useRefreshSession';

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
  const { refreshSession } = useRefreshSession();
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Fetch event data and pending registrations
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
        
        // Fetch pending registrations
        const registrationsResponse = await fetch(`/api/events/${eventId}/pending-registrations`);
        if (!registrationsResponse.ok) {
          throw new Error(`Failed to fetch registrations: ${registrationsResponse.status}`);
        }
        const registrationsData = await registrationsResponse.json();
        setRegistrations(registrationsData.pendingRegistrations || []);
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
  
  // Redirect if not authenticated or not organizer/admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/dashboard/events/${eventId}/pending`);
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
      
      // Update the local state to remove the approved registration
      setRegistrations(prev => prev.filter(reg => reg.id !== registrationId));
      
      // Force refresh the user's session to get updated role if it changed
      await refreshSession();
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
      
      // Update the local state to remove the rejected registration
      setRegistrations(prev => prev.filter(reg => reg.id !== registrationId));
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pending Registrations</h1>
        <Link 
          href={`/dashboard/events/${eventId}`}
          className="text-indigo-600 hover:text-indigo-800"
        >
          ← Back to Event Details
        </Link>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">{event.name}</h2>
        <p className="text-gray-600 mb-4">
          {new Date(event.date).toLocaleDateString()} at {event.location}
        </p>
      </div>
      
      {registrations.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-500">No pending registrations found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {registrations.map((registration) => (
            <div key={registration.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">
                    {registration.user?.name || 'Unknown User'}
                  </h3>
                  <p className="text-gray-500">{registration.user?.email}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Registered on {new Date(registration.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
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
              </div>
              
              <div className="mt-4 border-t pt-4">
                <h4 className="font-medium mb-2">Registration Responses:</h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {Object.entries(registration.responses).map(([key, value]) => {
                    const field = event.formSchema?.fields.find(f => f.name === key);
                    const label = field?.label || key;
                    
                    return (
                      <div key={key} className="flex flex-col">
                        <dt className="text-gray-500 text-sm">{label}:</dt>
                        <dd className="font-medium">{String(value)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}