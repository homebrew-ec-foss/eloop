'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { GenericQRDisplay } from '@/components/qr/GenericQRDisplay';

interface Registration {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  qrCode: string;
  status: 'pending' | 'approved' | 'rejected' | 'checked-in';
  checkedInAt?: string;
  // For organizers/admins viewing all registrations
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export default function RegistrationsPage() {
  const { data: session } = useSession();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  
  // Check if user is participant (only participants should see QR codes)
  const isParticipant = session?.user?.role === 'participant';

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const response = await fetch('/api/events/registrations');
        
        if (!response.ok) {
          throw new Error('Failed to fetch registrations');
        }
        
        const data = await response.json();
        setRegistrations(data.registrations);
      } catch (err) {
        console.error('Error fetching registrations:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchRegistrations();
    }
  }, [session]);
  
  // Just use the global refresh mechanism managed by the hook

  if (!session?.user) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p>You need to be signed in to view your registrations.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          {isParticipant ? 'Your Registrations' : 'All Registrations'}
        </h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-md">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          {isParticipant ? 'Your Registrations' : 'All Registrations'}
        </h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // If a registration is selected and user is a participant with approved status, show its QR code
  if (selectedRegistration && isParticipant) {
    // Only show QR code if registration is approved or checked-in
    if (selectedRegistration.status !== 'approved' && selectedRegistration.status !== 'checked-in') {
      return (
        <div className="p-6">
          <button 
            onClick={() => setSelectedRegistration(null)} 
            className="text-blue-600 hover:text-blue-800 mb-6 flex items-center"
          >
            ← Back to all registrations
          </button>
          
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
            <p className="font-medium">Registration Pending Approval</p>
            <p className="text-sm mt-1">Your registration is awaiting approval from the event organizer. You'll be able to access your QR code once approved.</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="p-6">
        <button 
          onClick={() => setSelectedRegistration(null)} 
          className="text-blue-600 hover:text-blue-800 mb-6 flex items-center"
        >
          ← Back to all registrations
        </button>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">{selectedRegistration.eventName}</h2>
          <p className="text-gray-600 mb-6">
            {new Date(selectedRegistration.eventDate).toLocaleDateString()} at{' '}
            {new Date(selectedRegistration.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          
          <div className="flex justify-center mb-6">
            <GenericQRDisplay 
              qrData={selectedRegistration.qrCode}
              title="Your Check-in QR Code"
              description="Present this to the event staff when you arrive"
            />
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Registration Status</h3>
            <div className="flex items-center">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                selectedRegistration.status === 'checked-in' ? 'bg-green-500' : 'bg-blue-500'
              }`}></span>
              <span>
                {selectedRegistration.status === 'checked-in' 
                  ? `Checked in on ${new Date(selectedRegistration.checkedInAt || '').toLocaleDateString()}` 
                  : 'Approved - Ready to check in'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {isParticipant ? 'Your Registrations' : 'All Registrations'}
      </h1>
      
      {registrations.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-500">
            {isParticipant 
              ? "You haven't registered for any events yet."
              : "No registrations found."}
          </p>
          {isParticipant && (
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
              Browse upcoming events
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {registrations.map((registration) => (
            <div key={registration.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="font-bold text-xl mb-2">{registration.eventName}</h2>
                  <p className="text-gray-600 mb-2">
                    {new Date(registration.eventDate).toLocaleDateString()} at{' '}
                    {new Date(registration.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {/* Show user info for organizers/admins */}
                  {!isParticipant && registration.userName && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Participant:</span> {registration.userName} ({registration.userEmail})
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center mb-4">
                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                  registration.status === 'checked-in' ? 'bg-green-500' : 
                  registration.status === 'approved' ? 'bg-blue-500' :
                  registration.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></span>
                <span className="text-sm text-gray-600">
                  {registration.status === 'checked-in' 
                    ? `Checked in on ${new Date(registration.checkedInAt || '').toLocaleDateString()}` 
                    : registration.status === 'approved'
                    ? 'Approved - Ready to check in'
                    : registration.status === 'rejected'
                    ? 'Registration rejected'
                    : 'Pending approval'}
                </span>
              </div>
              
              <div className="flex space-x-3">
                {/* Only participants with approved or checked-in status can see their QR codes */}
                {isParticipant && (registration.status === 'approved' || registration.status === 'checked-in') && (
                  <button
                    onClick={() => setSelectedRegistration(registration)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    Show QR Code
                  </button>
                )}
                <Link
                  href={`/dashboard/events/${registration.eventId}`}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded"
                >
                  Event Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}