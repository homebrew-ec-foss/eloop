'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface EventDetails {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  organizerId: string;
  checkpoints?: string[];
  unlockedCheckpoints?: string[];
  isRegistrationOpen?: boolean;
  formSchema?: {
    fields: Array<{
      id: string;
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };
}

interface PendingRegistration {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  responses: Record<string, unknown>;
  createdAt: string;
}

interface PageParams {
  params: Promise<{ id: string }>;
}

export default function EventPage({ params }: PageParams) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  
  const router = useRouter();
  const { data: session } = useSession();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch event: ${response.status}`);
        }
        
        const data = await response.json();
        setEvent(data.event);
      } catch (err) {
        console.error('Error fetching event:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Fetch pending registrations for organizers/admins
  useEffect(() => {
    const fetchPendingRegistrations = async () => {
      if (!session?.user?.role || !['admin', 'organizer'].includes(session.user.role)) {
        return;
      }

      try {
        setLoadingPending(true);
        const response = await fetch(`/api/events/${eventId}/pending-registrations`);
        
        if (response.ok) {
          const data = await response.json();
          setPendingRegistrations(data.registrations || []);
        }
      } catch (err) {
        console.error('Error fetching pending registrations:', err);
      } finally {
        setLoadingPending(false);
      }
    };

    if (session && event) {
      fetchPendingRegistrations();
    }
  }, [eventId, session, event]);

  const handleApprove = async (registrationId: string) => {
    try {
      setActionLoading(registrationId);
      const response = await fetch('/api/events/registrations/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      });

      if (response.ok) {
        // Remove from pending list
        setPendingRegistrations(prev => prev.filter(r => r.id !== registrationId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve registration');
      }
    } catch (err) {
      console.error('Error approving registration:', err);
      alert('Failed to approve registration');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (registrationId: string) => {
    try {
      setActionLoading(registrationId);
      const response = await fetch('/api/events/registrations/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      });

      if (response.ok) {
        // Remove from pending list
        setPendingRegistrations(prev => prev.filter(r => r.id !== registrationId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject registration');
      }
    } catch (err) {
      console.error('Error rejecting registration:', err);
      alert('Failed to reject registration');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckpointToggle = async (checkpoint: string, currentlyUnlocked: boolean) => {
    if (!event) return;

    // Prevent concurrent actions
    try {
      setActionLoading(checkpoint);

      // If we're unlocking a checkpoint that is NOT the special "Registration" checkpoint,
      // enforce the rule: only one non-registration checkpoint may be unlocked at a time.
      // So lock any other unlocked non-registration checkpoints first.
      const isUnlocking = !currentlyUnlocked;
      const SPECIAL_REG_NAME = 'Registration';

      if (isUnlocking && checkpoint !== SPECIAL_REG_NAME) {
        const othersToLock = (event.unlockedCheckpoints || []).filter(c => c !== checkpoint && c !== SPECIAL_REG_NAME);

        for (const other of othersToLock) {
          const lockResp = await fetch(`/api/events/${eventId}/unlock-checkpoint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkpoint: other, action: 'lock' }),
          });

          if (!lockResp.ok) {
            const errorData = await lockResp.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to lock checkpoint ${other}`);
          }

          const lockData = await lockResp.json();
          setEvent(prev => prev ? ({ ...prev, unlockedCheckpoints: lockData.event.unlockedCheckpoints }) : null);
        }
      }

      // Now toggle the requested checkpoint (either lock or unlock)
      const action = currentlyUnlocked ? 'lock' : 'unlock';
      const response = await fetch(`/api/events/${eventId}/unlock-checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint, action }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update checkpoint');
      }

      const data = await response.json();
      // Update local state with canonical server response
      setEvent(prev => prev ? ({ ...prev, unlockedCheckpoints: data.event.unlockedCheckpoints }) : null);
    } catch (err) {
      console.error('Error updating checkpoint:', err);
      alert(`Failed to update checkpoint access: ${(err as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegistrationToggle = async (currentlyOpen: boolean) => {
    try {
      const response = await fetch(`/api/events/${eventId}/toggle-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: !currentlyOpen }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle registration');
      }

      const data = await response.json();
      
      // Update local state
      setEvent(prev => prev ? {
        ...prev,
        isRegistrationOpen: data.event.isRegistrationOpen
      } : null);
      
      alert(data.message);
    } catch (err) {
      console.error('Error toggling registration:', err);
      alert(`Failed to toggle registration: ${(err as Error).message}`);
    }
  };

  if (loading) {
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
          <p>The event you&apos;re looking for might have been removed or doesn&apos;t exist.</p>
        </div>
        <Link href="/dashboard/events" className="text-indigo-600 hover:text-indigo-800">
          ← Back to all events
        </Link>
      </div>
    );
  }

  // Format the date for display
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/events" className="text-indigo-600 hover:text-indigo-800">
          ← Back to all events
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          
          <div className="flex space-x-3">
            {/* Register button - only show for participants/applicants, not organizers/admins */}
            {session && !['admin', 'organizer'].includes(session.user.role) ? (
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                onClick={() => router.push(`/register/${event.id}`)}
              >
                Register for Event
              </button>
            ) : !session && (
              <Link
                href="/auth/signin"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Sign In to Register
              </Link>
            )}

            {session?.user?.role && ['admin', 'organizer', 'volunteer'].includes(session.user.role) && (
              <>
                <button
                  className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100"
                  onClick={() => router.push(`/dashboard/events/${event.id}/registrations`)}
                >
                  View Registrations
                </button>
                {['admin', 'organizer'].includes(session.user.role) && (
                  <button
                    className="px-3 py-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 flex items-center gap-1"
                    onClick={() => window.open(`/api/events/${event.id}/export`, '_blank')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium mb-2">Date & Time</h2>
            <p>{formattedDate} at {formattedTime}</p>
          </div>
          
          <div>
            <h2 className="text-lg font-medium mb-2">Location</h2>
            <p>{event.location}</p>
          </div>
          
          <div>
            <h2 className="text-lg font-medium mb-2">Description</h2>
            <p className="whitespace-pre-line">{event.description}</p>
          </div>
        </div>
      </div>
      
      {/* Checkpoint Access Control - Only for Organizers/Admins */}
      {session?.user?.role && ['admin', 'organizer'].includes(session.user.role) && 
       event.checkpoints && event.checkpoints.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-medium mb-2">Checkpoint Access Control</h2>
          <p className="text-gray-600 text-sm mb-4">
            Check the boxes below to unlock checkpoints for volunteers. Volunteers can only scan participants at unlocked checkpoints.
          </p>
          
          <div className="space-y-3">
            {event.checkpoints.map((checkpoint, idx) => {
              const isUnlocked = event.unlockedCheckpoints?.includes(checkpoint) ?? false;
              // If unlocked, show its position in the unlockedCheckpoints array (reflects pick/unlock order)
              const unlockedIdx = event.unlockedCheckpoints?.indexOf(checkpoint) ?? -1;
              const displaySeq = unlockedIdx >= 0 ? unlockedIdx + 1 : idx + 1;

              return (
                <div 
                  key={checkpoint} 
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    id={`checkpoint-${checkpoint}`}
                    checked={isUnlocked}
                    onChange={() => handleCheckpointToggle(checkpoint, isUnlocked)}
                    disabled={!!actionLoading}
                    className="h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="ml-3 flex-1 cursor-pointer flex items-center">
                    <span className="inline-flex items-center justify-center mr-3 w-12 h-8 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                      {displaySeq}
                    </span>
                    <div>
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">{checkpoint}</span>
                        {/* volunteer-visible sequence remains available via unlocked state */}
                      </div>
                      <div>
                        <span className={`text-sm ${isUnlocked ? 'text-green-600' : 'text-gray-500'}`}>
                          {isUnlocked ? '✅ Unlocked - Volunteers can scan' : '❌ Locked - Volunteers cannot scan'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Registration Control - Only for Organizers/Admins */}
      {session?.user?.role && ['admin', 'organizer'].includes(session.user.role) && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-medium mb-2">Registration Control</h2>
          <p className="text-gray-600 text-sm mb-4">
            Control whether new applicants can register for this event. When closed, the registration page will show a message that registration is currently closed.
          </p>
          
          <div className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              id="registration-toggle"
              checked={event.isRegistrationOpen ?? true}
              onChange={() => handleRegistrationToggle(event.isRegistrationOpen ?? true)}
              className="h-6 w-6 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <label 
              htmlFor="registration-toggle"
              className="ml-4 flex-1 cursor-pointer"
            >
              <span className="font-semibold text-lg text-gray-900">Accept New Registrations</span>
              <span className={`ml-3 text-base font-medium ${event.isRegistrationOpen ?? true ? 'text-green-600' : 'text-red-600'}`}>
                {event.isRegistrationOpen ?? true ? '✅ Open - Applicants can register' : '🚫 Closed - Registration disabled'}
              </span>
            </label>
          </div>
        </div>
      )}
      
      {/* Pending Registrations Section for Organizers/Admins */}
      {session?.user?.role && ['admin', 'organizer'].includes(session.user.role) && pendingRegistrations.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-medium mb-4 flex items-center">
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm font-semibold mr-3">
              {pendingRegistrations.length}
            </span>
            Pending Registrations
          </h2>
          
          {loadingPending ? (
            <div className="text-gray-500">Loading pending registrations...</div>
          ) : (
            <div className="space-y-4">
              {pendingRegistrations.map((registration) => (
                <div key={registration.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{registration.userName}</h3>
                      <p className="text-gray-600 text-sm">{registration.userEmail}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        Registered: {new Date(registration.createdAt).toLocaleString()}
                      </p>
                      
                      {/* Show registration responses */}
                      {registration.responses && Object.keys(registration.responses).length > 0 && (
                        <div className="mt-3 space-y-1">
                          {Object.entries(registration.responses).map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium text-gray-700">{key}:</span>{' '}
                              <span className="text-gray-600">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleApprove(registration.id)}
                        disabled={actionLoading === registration.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading === registration.id ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(registration.id)}
                        disabled={actionLoading === registration.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading === registration.id ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-medium mb-4">Registration Form</h2>
        
        {event.formSchema?.fields ? (
          <div className="space-y-6">
            <p className="text-gray-600">
              Participants will fill out the following fields when registering:
            </p>
            
            <div className="space-y-3">
              {event.formSchema.fields.map((field) => (
                <div key={field.id} className="p-3 border border-gray-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{field.label}</p>
                      <p className="text-sm text-gray-600">
                        {field.type} · {field.required ? 'Required' : 'Optional'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-center">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                onClick={() => router.push(`/register/${event.id}`)}
              >
                View Registration Page
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">No registration form found for this event.</p>
        )}
      </div>
    </div>
  );
}