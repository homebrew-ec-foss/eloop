'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

export default function RegistrationsClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch event data and registrations
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

        // Fetch all registrations
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

  // Redirect if not authenticated or not organizer/admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/organizer/dashboard/events/${eventId}/registrations`);
    } else if (status === 'authenticated' &&
               session.user.role !== 'admin' &&
               session.user.role !== 'organizer') {
      router.push('/dashboard');
    }
  }, [status, session, router, eventId]);

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
        <Link href="/organizer/dashboard/events" className="text-indigo-600 hover:text-indigo-800">
          ← Back to all events
        </Link>
      </div>
    );
  }

  // Count registrations by status
  const counts = {
    total: registrations.length,
    approved: registrations.filter(r => r.status === 'approved').length,
    pending: registrations.filter(r => r.status === 'pending').length,
    rejected: registrations.filter(r => r.status === 'rejected').length,
    checkedIn: registrations.filter(r => r.status === 'checked-in').length
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Event Registrations</h1>
        <Link
          href={`/organizer/dashboard/events/${eventId}`}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div className="bg-indigo-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-indigo-700">{counts.total}</p>
            <p className="text-sm text-indigo-600">Total</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-700">{counts.approved}</p>
            <p className="text-sm text-green-600">Approved</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-700">{counts.pending}</p>
            <p className="text-sm text-yellow-600">Pending</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">{counts.checkedIn}</p>
            <p className="text-sm text-blue-600">Checked In</p>
          </div>
        </div>
      </div>

      {registrations.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-500">No registrations found.</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participant
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registered On
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {registrations.map((registration) => (
                <tr key={registration.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{registration.user?.name || 'Unknown User'}</div>
                    <div className="text-sm text-gray-500">{registration.user?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${registration.status === 'approved' ? 'bg-green-100 text-green-800' :
                        registration.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        registration.status === 'checked-in' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'}`}>
                      {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(registration.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      onClick={() => {
                        // Open a modal with registration details
                        alert(JSON.stringify(registration.responses, null, 2));
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}