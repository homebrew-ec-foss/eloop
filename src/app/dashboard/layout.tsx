'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SharedDashboardLayout from '@/components/dashboard/SharedDashboardLayout';
import type { UserRole } from '@/types';

const getRoleConfig = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return {
        title: 'Admin Dashboard',
        colorScheme: 'purple' as const,
        roleLabel: 'Administrator',
        navigation: [
          {
            title: 'Overview',
            items: [
              { href: '/dashboard', label: 'Dashboard' },
            ],
          },
          {
            title: 'Administration',
            items: [
              { href: '/dashboard/users', label: 'User Management' },
            ],
          },
        ],
      };
    case 'organizer':
      return {
        title: 'Organizer Dashboard',
        colorScheme: 'blue' as const,
        roleLabel: 'Event Organizer',
        navigation: [
          {
            title: 'Overview',
            items: [
              { href: '/dashboard', label: 'Dashboard' },
            ],
          },
          {
            title: 'Management',
            items: [
              { href: '/dashboard/volunteers', label: 'Volunteer Management' },
            ],
          },
        ],
      };
    case 'volunteer':
      return {
        title: 'Volunteer Dashboard',
        colorScheme: 'teal' as const,
        roleLabel: 'Event Volunteer',
        navigation: [
          {
            title: 'Check-In',
            items: [
              { href: '/dashboard/events/check-in', label: 'QR Scanner' },
            ],
          },
        ],
      };
    case 'applicant':
      return {
        title: 'Welcome',
        colorScheme: 'amber' as const,
        roleLabel: 'Applicant',
        navigation: [
          {
            title: 'Get Started',
            items: [
              { href: '/dashboard', label: 'Home' },
              { href: '/dashboard/events', label: 'Browse Events' },
            ],
          },
        ],
      };
    case 'participant':
    default:
      return {
        title: 'Participant Dashboard',
        colorScheme: 'green' as const,
        roleLabel: 'Participant',
        navigation: [
          {
            title: 'My Activity',
            items: [
              { href: '/dashboard', label: 'Dashboard' },
            ],
          },
        ],
      };
  }
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const role = session.user.role || 'participant';
  const config = getRoleConfig(role);

  return (
    <SharedDashboardLayout
      title={config.title}
      colorScheme={config.colorScheme}
      roleLabel={config.roleLabel}
      navigation={config.navigation}
    >
      {children}
    </SharedDashboardLayout>
  );
}