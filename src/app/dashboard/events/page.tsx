'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Event } from '@/types';
import dynamic from 'next/dynamic';

// Define API event type that might have string dates
interface EventFromAPI {
  id: string;
  name: string;
  description: string;
  date: string | Date;
  location: string;
  organizerId: string;
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

export default function EventsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [userRegistrations, setUserRegistrations] = useState<Record<string, { status: string; id: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch events');
        }

        const data = await response.json();
        const allEvents = data.events || [] as EventFromAPI[];

        console.log('Fetched events from API:', allEvents);
        console.log('Current user role:', session?.user?.role);

        // For admin and organizers, show ALL events (past and future)
        // For participants, filter to only upcoming events
        // For applicants, show only the LATEST/MOST RECENT event
        let filteredEvents = allEvents;
        if (session?.user?.role === 'participant') {
          const currentDate = new Date();
          filteredEvents = allEvents.filter((event: EventFromAPI) => {
            const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
            console.log('Event date:', eventDate, 'Current date:', currentDate, 'Is future:', eventDate > currentDate);
            return eventDate > currentDate;
          });
        } else if (session?.user?.role === 'applicant') {
          // Applicants only see the most recent event (sorted by date, latest first)
          const sortedEvents = [...allEvents].sort((a: EventFromAPI, b: EventFromAPI) => {
            const dateA = a.date instanceof Date ? a.date : new Date(a.date);
            const dateB = b.date instanceof Date ? b.date : new Date(b.date);
            return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
          });
          filteredEvents = sortedEvents.length > 0 ? [sortedEvents[0]] : [];
        }

        console.log('Final filtered events:', filteredEvents);
        setEvents(filteredEvents);

        // Fetch registration counts for events
        if (filteredEvents.length > 0) {
          const eventIds = filteredEvents.map((event: EventFromAPI) => event.id).join(',');
          const countsResponse = await fetch(`/api/events/registration-counts?eventIds=${eventIds}`);

          if (countsResponse.ok) {
            const countsData = await countsResponse.json();
            console.log('Registration counts received:', countsData);
            setRegistrationCounts(countsData.registrationCounts || {});
          } else {
            console.error('Failed to fetch registration counts');
          }
        }

        // For participants, fetch their registrations to show status
        if (session?.user?.role === 'participant') {
          try {
            const regsResponse = await fetch('/api/events/registrations');
            if (regsResponse.ok) {
              const regsData = await regsResponse.json();
              const regsByEvent: Record<string, { status: string; id: string }> = {};
              regsData.registrations.forEach((reg: { eventId: string; status: string; id: string }) => {
                regsByEvent[reg.eventId] = { status: reg.status, id: reg.id };
              });
              setUserRegistrations(regsByEvent);
            }
          } catch (err) {
            console.error('Error fetching user registrations:', err);
          }
        }
      } catch (error) {
        console.error('Error loading events:', error);
        setError(error instanceof Error ? error.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchEvents();
    }
  }, [session]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateTimeToEvent = (eventDate: Date | string) => {
    const date = typeof eventDate === 'string' ? new Date(eventDate) : eventDate;
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Event has passed';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours} hr${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hr${hours !== 1 ? 's' : ''}`;
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;

    setDeletingEventId(eventId);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEvents(events.filter(e => e.id !== eventId));
      } else {
        alert('Failed to delete event');
      }
    } catch (error) {
      alert('Error deleting event');
    } finally {
      setDeletingEventId(null);
    }
  };

  const calculateDurationHours = (startDate?: Date | string, endDate?: Date | string) => {
    if (!startDate || !endDate) return null;

    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min`;
    } else if (hours > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} min`;
    }
  };

  const userRole = session?.user?.role || 'participant';
  const pageTitle = userRole === 'admin' ? 'All Events' :
    userRole === 'organizer' ? 'All Events' :
      userRole === 'applicant' ? 'Latest Event' :
        'Available Events';

  // Only organizers can create events, NOT admins
  const canCreateEvent = userRole === 'organizer';
  // Only admins and organizers can see applicant management features
  const canManageApplicants = userRole === 'admin' || userRole === 'organizer';

  return (
    <div className="space-y-6">
      {/* Show sign-in banner for non-authenticated users */}
      {!session && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mx-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-indigo-900">Sign in to register for events</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Create an account to register for events and track your registrations
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium whitespace-nowrap transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}

      <div className="mx-6 flex flex-col sm:flex-row sm:justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and organize your events</p>
        </div>

        <div className="flex items-center gap-3">


          {canCreateEvent && (
            <Link
              href="/dashboard/events/create"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
            >
              Create Event
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl mb-6 mx-6">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 mx-6">
          <p className="text-slate-500">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="mx-6 space-y-4">
          {canCreateEvent ? (
            <>
              <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">No events created yet</h2>
                <p className="text-slate-500 mb-6">Start by creating your first event to see it listed here.</p>
                <Link
                  href="/dashboard/events/create"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium inline-block transition-colors"
                >
                  Create Your First Event
                </Link>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 p-12 rounded-2xl text-center shadow-sm mx-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No events available</h2>
              <p className="text-slate-500 mb-6">There are currently no upcoming events to register for.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mx-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const userReg = userRegistrations[event.id];
            const isParticipant = userRole === 'participant';

            return (
              <div key={event.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {event.name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {event.description || 'No description provided'}
                    </p>
                  </div>

                  {/* Event Timing Information */}
                  <div className="space-y-2 text-sm">
                    {/* Start Time */}
                    <div className="flex items-center text-slate-600">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs uppercase tracking-wide font-medium text-slate-500">Starts:</span>
                      <span className="ml-2">{formatDate(event.date.toString())}</span>
                    </div>

                    {/* End Time */}
                    {event.endDate && (
                      <div className="flex items-center text-slate-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs uppercase tracking-wide font-medium text-slate-500">Ends:</span>
                        <span className="ml-2">{formatDate(event.endDate.toString())}</span>
                      </div>
                    )}

                    {/* Duration */}
                    {event.startDate && event.endDate && (
                      <div className="flex items-center text-indigo-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-xs uppercase tracking-wide font-medium text-slate-500">Duration:</span>
                        <span className="ml-2">{calculateDurationHours(event.startDate, event.endDate)}</span>
                      </div>
                    )}

                    {/* Time to Event */}
                    <div className="flex items-center text-emerald-600">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs uppercase tracking-wide font-medium text-slate-500">In:</span>
                      <span className="ml-2">{calculateTimeToEvent(event.date)}</span>
                    </div>

                    {/* Registration Close Date */}
                    {event.registrationCloseDate && (
                      <div className="flex items-center text-amber-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs uppercase tracking-wide font-medium text-slate-500">Reg closes:</span>
                        <span className="ml-2">{calculateTimeToEvent(event.registrationCloseDate)}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium text-slate-700">Location:</span> {event.location || 'No location specified'}
                    </p>
                  </div>

                  {/* Show registration status for participants */}
                  {isParticipant && userReg && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`inline-block w-2 h-2 rounded-full ${userReg.status === 'checked-in' ? 'bg-emerald-500' :
                          userReg.status === 'approved' ? 'bg-indigo-500' :
                            userReg.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'
                          }`}></span>
                        <span className="font-medium text-slate-700">
                          {userReg.status === 'checked-in' ? '✓ Checked in' :
                            userReg.status === 'approved' ? '✓ Approved' :
                              userReg.status === 'rejected' ? '✗ Rejected' : '⏳ Pending approval'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 space-y-2">
                  {/* Registration button for applicants/participants who haven't registered */}
                  {(userRole === 'applicant' || (isParticipant && !userReg)) && (
                    <Link
                      href={`/register/${event.id}`}
                      className="block w-full text-center px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors"
                    >
                      Register for Event
                    </Link>
                  )}

                  {/* View Details and View Registrations */}
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      className="flex-1 text-center px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 font-medium text-sm transition-colors"
                    >
                      View Details
                    </Link>

                    {/* View Registrations button for organizers and admins */}
                    {(userRole === 'admin' || userRole === 'organizer') && (
                      <Link
                        href={`/dashboard/events/${event.id}/registrations`}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Registrations
                      </Link>
                    )}
                  </div>

                  {/* Delete button for organizers */}
                  {userRole === 'organizer' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={(registrationCounts[event.id] || 0) > 0 || deletingEventId === event.id}
                        className="flex-1 text-center px-3 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        title={(registrationCounts[event.id] || 0) > 0 ? "Cannot delete event with existing registrations" : "Delete event"}
                      >
                        {deletingEventId === event.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}

                  {(userRole === 'admin' || userRole === 'organizer') && (
                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                      {registrationCounts[event.id] || 0} <span className="text-slate-400">registrations</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}