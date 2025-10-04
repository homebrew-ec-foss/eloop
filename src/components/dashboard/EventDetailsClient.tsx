'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface EventDetails {
  id: string;
  name: string;
  description: string;
  date: string;
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

export default function EventDetailsClient({ eventId }: { eventId: string }) {
  useSession(); // Keep authentication check
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded w-full"></div>
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <Link
          href="/organizer/dashboard/events"
          className="text-indigo-600 hover:text-indigo-800"
        >
          ← Back to all events
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Event Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600 mb-2">
              <span className="font-medium">Date:</span> {new Date(event.date).toLocaleDateString()}
            </p>
            <p className="text-gray-600 mb-2">
              <span className="font-medium">Location:</span> {event.location}
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-2">
              <span className="font-medium">Event ID:</span> {event.id}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-gray-600">
            <span className="font-medium">Description:</span>
          </p>
          <p className="mt-2">{event.description}</p>
        </div>
      </div>

      {event.formSchema && event.formSchema.fields.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Registration Form</h2>
          <div className="space-y-3">
            {event.formSchema.fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{field.label}</p>
                  <p className="text-sm text-gray-600">
                    Type: {field.type} {field.required && '(Required)'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href={`/organizer/dashboard/events/${eventId}/pending`}
            className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition-colors"
          >
            <div className="text-blue-600 font-medium">Pending Registrations</div>
            <div className="text-sm text-blue-500 mt-1">Review and approve registrations</div>
          </Link>
          <Link
            href={`/dashboard/events/${eventId}/check-in`}
            className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition-colors"
          >
            <div className="text-green-600 font-medium">Check-in</div>
            <div className="text-sm text-green-500 mt-1">Scan QR codes for check-in</div>
          </Link>
          <Link
            href={`/dashboard/events/${eventId}/registrations`}
            className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-center transition-colors"
          >
            <div className="text-purple-600 font-medium">All Registrations</div>
            <div className="text-sm text-purple-500 mt-1">View all event registrations</div>
          </Link>
        </div>
      </div>
    </div>
  );
}