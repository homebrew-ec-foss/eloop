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

  const StatCard = ({
    label,
    value,
    href,
    helper,
    accent = 'text-indigo-600',
  }: {
    label: string;
    value: string | number;
    href?: string;
    helper?: string;
    accent?: string;
  }) => {
    const content = (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`text-3xl font-semibold mt-1 ${accent}`}>{value}</p>
        {helper && <p className="text-xs text-slate-500 mt-2">{helper}</p>}
      </div>
    );
    if (href) {
      return (
        <Link href={href} className="block">
          {content}
        </Link>
      );
    }
    return content;
  };

  // Approval message template controlled via env (client-accessible via NEXT_PUBLIC_*)
  const approvalTemplate =
    process.env.NEXT_PUBLIC_APPROVAL_MESSAGE ||
    "You will receive an email at <strong>{email}</strong> once your application is approved. If selected, submit the payment screenshots when requested. After approval by the organizer, your QR code will appear here and you can show up to the event";

  const escapeHtml = (unsafe?: string) => {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const approvalMessageHtml = approvalTemplate.replace('{email}', escapeHtml(session?.user?.email || ''));

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
      <div className="space-y-6 md:space-y-8">
        {showSuccessMessage && registeredEventName && (
          <div className="bg-white border border-green-200 rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center text-xl">✓</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900">Registration successful</h3>
                <p className="text-slate-700 mt-1">You registered for <strong>{registeredEventName}</strong>.</p>
                <p className="text-sm text-slate-600 mt-2" dangerouslySetInnerHTML={{ __html: approvalMessageHtml }} />
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="mt-3 text-sm font-medium text-green-700 hover:text-green-900"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700">Applicant</p>
              <h2 className="text-2xl font-semibold text-amber-900">Welcome</h2>
              <p className="text-slate-700 mt-1">Browse events and register. You&apos;ll get a QR after approval.</p>
            </div>
            <p className="text-sm text-slate-600 md:max-w-sm" dangerouslySetInnerHTML={{ __html: approvalMessageHtml }} />
          </div>
        </div>

        {!hasRegistration && latestEvent && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Latest event</p>
                <h3 className="text-xl font-semibold text-slate-900">{latestEvent.name}</h3>
                <p className="text-slate-600 mt-1">
                  {new Date(latestEvent.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-slate-600 mt-2 line-clamp-2">{latestEvent.description}</p>
                <p className="text-sm text-slate-500 mt-2">Location: {latestEvent.location}</p>
              </div>
              <Link
                href={`/register/${latestEvent.id}`}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700"
              >
                Register now
              </Link>
            </div>
          </div>
        )}

        {!hasRegistration && !latestEvent && (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-5 text-center text-slate-600">
            No events are open right now. Check back soon.
          </div>
        )}

        <UserRegistrationsSection />
      </div>
    );
  }

  // Admin Dashboard
  if (role === 'admin') {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Admin</p>
            <h2 className="text-2xl font-semibold text-slate-900">Overview</h2>
            <p className="text-slate-600 mt-1">Monitor events, people, and scan health at a glance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/users" className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow hover:bg-indigo-700">Manage users</Link>
            <Link href="/dashboard/scan-logs" className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:border-indigo-200">
              Scan logs
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard label="Total events" value={Number(stats.events || 0)} href="/dashboard/events" />
          <StatCard label="Total users" value={Number(stats.users || 0)} href="/dashboard/users" accent="text-emerald-600" />
          <StatCard label="Pending approvals" value={Number(stats.pendingApprovals || 0)} href="/dashboard/users?filter=applicant" accent="text-amber-600" />
          <StatCard label="Failed scans" value={Number(stats.failedScans || 0)} href="/dashboard/scan-logs" helper="Tap to review errors" accent="text-rose-600" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Organizers</p>
            <p className="text-2xl font-semibold text-indigo-600 mt-1">{stats.organizers || 0}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Volunteers</p>
            <p className="text-2xl font-semibold text-teal-600 mt-1">{stats.volunteers || 0}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-slate-500">Participants</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">{stats.participants || 0}</p>
          </div>
        </div>
      </div>
    );
  }

  // Organizer Dashboard
  if (role === 'organizer') {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Organizer</p>
            <h2 className="text-2xl font-semibold text-slate-900">Your events</h2>
            <p className="text-slate-600 mt-1">Track registrations and volunteer coverage.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/events/create" className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow hover:bg-blue-700">Create event</Link>
            <Link href="/dashboard/volunteers" className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:border-blue-200">Volunteers</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard label="My events" value={Number(stats.events || 0)} href="/dashboard/events" accent="text-blue-600" />
          <StatCard label="Volunteers" value={Number(stats.volunteers || 0)} href="/dashboard/volunteers" accent="text-teal-600" />
          <StatCard label="Pending registrations" value={Number(stats.pendingRegistrations || 0)} href="/dashboard/events" helper="Open an event to review" accent="text-amber-600" />
          <StatCard label="Failed scans" value={Number(stats.failedScans || 0)} href="/dashboard/scan-logs" accent="text-indigo-600" />
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