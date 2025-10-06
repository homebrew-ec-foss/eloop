'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import UserRegistrationsSection from '@/components/dashboard/UserRegistrationsSection';

interface DashboardStats {
  role: string;
  [key: string]: string | number | boolean;
}

export default function UnifiedDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestEvent, setLatestEvent] = useState<any>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [registeredEventName, setRegisteredEventName] = useState<string>('');
  const [hasRegistration, setHasRegistration] = useState(false);

  // Check if user has any registration
  useEffect(() => {
    const checkRegistration = async () => {
      if (session?.user?.role === 'applicant') {
        try {
          const res = await fetch('/api/users/me/status');
          if (res.ok) {
            const data = await res.json();
            setHasRegistration(data.hasRegistration);
          }
        } catch (error) {
          console.error('Error checking registration:', error);
        }
      }
    };
    
    if (session?.user) {
      checkRegistration();
    }
  }, [session?.user, searchParams]); // Re-check when searchParams change (after registration)

  // Check for registration success message
  useEffect(() => {
    const registration = searchParams.get('registration');
    const eventName = searchParams.get('event');
    
    if (registration === 'success' && eventName) {
      setShowSuccessMessage(true);
      setRegisteredEventName(decodeURIComponent(eventName));
      
      // Clear the query params after a short delay
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('registration');
        url.searchParams.delete('event');
        window.history.replaceState({}, '', url.pathname);
      }, 100);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchStats();
      
      // Fetch latest event for applicants
      if (session?.user?.role === 'applicant') {
        fetchLatestEvent();
      }
    }
  }, [status, router, session?.user?.role]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      
      // Check if the user's role in the database differs from their session role
      // This happens when an applicant is approved to participant
      if (data.role && session?.user?.role && data.role !== session.user.role) {
        console.log(`Role mismatch detected: session=${session.user.role}, database=${data.role}`);
        console.log('Logging out to refresh session with new role...');
        
        // Sign out and redirect to sign in
        await signOut({ 
          callbackUrl: '/auth/signin?message=Your role has been updated. Please sign in again.' 
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestEvent = async () => {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) return;
      const data = await res.json();
      const allEvents = data.events || [];
      
      // Sort by date, get the latest
      const sortedEvents = [...allEvents].sort((a: any, b: any) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      
      if (sortedEvents.length > 0) {
        setLatestEvent(sortedEvents[0]);
      }
    } catch (error) {
      console.error('Error fetching latest event:', error);
    }
  };

  // Volunteer auto-redirect to check-in (immediate, don't wait for stats)
  useEffect(() => {
    if (session?.user?.role === 'volunteer') {
      router.push('/dashboard/events/check-in');
    }
  }, [session?.user?.role, router]);

  // Organizer auto-redirect to their single event
  useEffect(() => {
    const redirectOrganizerToEvent = async () => {
      if (session?.user?.role === 'organizer') {
        try {
          const res = await fetch('/api/events');
          if (res.ok) {
            const data = await res.json();
            if (data.events && data.events.length === 1) {
              // Only one event, redirect to it
              router.push(`/dashboard/events/${data.events[0].id}`);
            }
          }
        } catch (error) {
          console.error('Error fetching organizer events:', error);
        }
      }
    };

    redirectOrganizerToEvent();
  }, [session?.user?.role, router]);

  if (loading || status === 'loading') {
    return (
      <div className="animate-pulse space-y-4 md:space-y-6">
        <div className="h-6 md:h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 md:p-6 rounded-lg shadow-sm">
              <div className="h-3 md:h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-6 md:h-8 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div>Error loading dashboard</div>;
  }

  const role = session?.user?.role || 'applicant';

    // Applicant Dashboard - Can browse and register for events
  if (role === 'applicant') {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Registration Success Message */}
        {showSuccessMessage && registeredEventName && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:p-6">
            <div className="flex items-start">
              <svg className="h-6 w-6 text-green-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-1">Registration Successful! 🎉</h3>
                <p className="text-green-800 mb-2">
                  You have successfully registered for <strong>{registeredEventName}</strong>
                </p>
                <p className="text-green-700 text-sm">
                  You will receive an email at <strong>{session?.user?.email}</strong> once your application is approved. If selected, submit the payment screenshots when requested. After approval by the organizer, your QR code will appear here and you can show up to the event
                </p>
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-3 mt-3">
                  <p className="text-amber-800 text-sm mb-1">If approved you&apos;ll be a participant and can check in at the event.</p>
                  <p className="text-amber-800 text-sm font-semibold">Refresh to see changes.</p>
                </div>
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="mt-3 text-sm text-green-700 hover:text-green-900 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 md:p-6">
          <div className="flex items-center mb-3">
            <div className="bg-amber-100 rounded-full p-2 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-amber-900">Welcome!</h2>
          </div>
          <p className="text-amber-800 mb-2">
            Browse and register for events. If approved you&apos;ll be a participant and can check in.
          </p>
          <p className="text-amber-700 text-sm mt-2">
            You will receive an email at <strong>{session?.user?.email}</strong> once your application is approved. If selected, submit the payment screenshots when requested. After approval by the organizer, your QR code will appear here and you can show up to the event
          </p>
        </div>

        {/* Show latest event only if user hasn't registered yet */}
        {!hasRegistration && latestEvent ? (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm">
            <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Latest Event</h3>
            <div className="border rounded-lg p-4">
              <h4 className="text-xl font-bold mb-2">{latestEvent.name}</h4>
              <p className="text-gray-600 mb-3">
                {new Date(latestEvent.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-gray-700 mb-3 line-clamp-2">{latestEvent.description}</p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Location:</strong> {latestEvent.location}
              </p>
              <Link
                href={`/register/${latestEvent.id}`}
                className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Register for Event →
              </Link>
            </div>
          </div>
        ) : !hasRegistration && !latestEvent ? (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm">
            <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Latest Event</h3>
            <p className="text-gray-600">No events available at the moment.</p>
          </div>
        ) : null}

        {/* Show user's registrations if any */}
        <UserRegistrationsSection />
      </div>
    );
  }

  // Admin Dashboard
  if (role === 'admin') {
    return (
      <div className="space-y-4 md:space-y-6">
        <h2 className="text-xl md:text-2xl font-bold">Admin Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Link href="/dashboard/events" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">Total Events</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.events || 0}</p>
          </Link>

          <Link href="/dashboard/users" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">Total Users</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.users || 0}</p>
          </Link>

          <Link href="/dashboard/users?filter=applicant" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">Pending Approvals</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2 text-amber-600">{stats.pendingApprovals || 0}</p>
          </Link>

          <Link href="/dashboard/scan-logs" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">Scan Logs</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2 text-red-600">{stats.failedScans || 0}</p>
            <p className="text-xs text-gray-500 mt-2">Failed scans · Click to view all</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Organizers</p>
            <p className="text-xl font-bold text-purple-600">{stats.organizers || 0}</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Volunteers</p>
            <p className="text-xl font-bold text-teal-600">{stats.volunteers || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Participants</p>
            <p className="text-xl font-bold text-green-600">{stats.participants || 0}</p>
          </div>
        </div>

        <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <Link href="/dashboard/users" 
            className="bg-purple-100 hover:bg-purple-200 text-purple-800 p-3 md:p-4 rounded-md font-medium transition-colors text-sm md:text-base">
            Manage Users & Assign Organizers
          </Link>
          <Link href="/dashboard/analytics" 
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 p-3 md:p-4 rounded-md font-medium transition-colors text-sm md:text-base">
            View Analytics
          </Link>
        </div>
      </div>
    );
  }

  // Organizer Dashboard
  if (role === 'organizer') {
    return (
      <div className="space-y-4 md:space-y-6">
        <h2 className="text-xl md:text-2xl font-bold">Organizer Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Link href="/dashboard/events" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">My Events</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.events}</p>
          </Link>

          <Link href="/dashboard/volunteers" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">My Volunteers</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2">{stats.volunteers}</p>
          </Link>

          <Link href="/dashboard/events" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">Pending Registrations</p>
            <p className="text-xs text-gray-500">Select an event to review</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2 text-amber-600">{stats.pendingRegistrations}</p>
          </Link>

          <Link href="/dashboard/scan-logs" className="bg-white p-4 md:p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-600 font-medium text-sm md:text-base">Scan Logs</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2 text-blue-600">{stats.failedScans || 0}</p>
            <p className="text-xs text-gray-500 mt-2">Failed scans · Click to view all</p>
          </Link>
        </div>

        <h3 className="text-lg md:text-xl font-semibold mt-6 md:mt-8 mb-3 md:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Link href="/dashboard/events/create" 
            className="bg-blue-100 hover:bg-blue-200 text-blue-800 p-3 md:p-4 rounded-md font-medium transition-colors text-sm md:text-base">
            Create New Event
          </Link>
          <Link href="/dashboard/events" 
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 p-3 md:p-4 rounded-md font-medium transition-colors text-sm md:text-base">
            Manage Events
          </Link>
          <Link href="/dashboard/volunteers" 
            className="bg-teal-100 hover:bg-teal-200 text-teal-800 p-3 md:p-4 rounded-md font-medium transition-colors text-sm md:text-base">
            Manage Volunteers
          </Link>
        </div>
      </div>
    );
  }

  // Participant Dashboard
  if (role === 'participant') {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl md:text-2xl font-bold">
            Welcome, {session?.user?.name?.split(' ')[0]}
          </h2>
        </div>

        {/* User Registration Section - Shows QR and checkpoint status */}
        <UserRegistrationsSection />
      </div>
    );
  }

  return <div>Unknown role</div>;
}