'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SignOutButton } from '@/components/auth/SignOutButton';

interface NavigationItem {
  href: string;
  label: string;
  section?: string;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

interface SharedDashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  colorScheme: 'purple' | 'blue' | 'teal' | 'green' | 'amber' | 'indigo' | 'rose';
  navigation: NavigationSection[];
  roleLabel: string;
  additionalLinks?: React.ReactNode;
}

const colorSchemes = {
  purple: {
    bg: 'bg-purple-900',
    bgLight: 'bg-purple-700',
    bgHover: 'hover:bg-purple-800',
    textLight: 'text-purple-300',
    border: 'border-purple-800',
  },
  blue: {
    bg: 'bg-blue-900',
    bgLight: 'bg-blue-700',
    bgHover: 'hover:bg-blue-800',
    textLight: 'text-blue-300',
    border: 'border-blue-800',
  },
  teal: {
    bg: 'bg-teal-900',
    bgLight: 'bg-teal-700',
    bgHover: 'hover:bg-teal-800',
    textLight: 'text-teal-300',
    border: 'border-teal-800',
  },
  green: {
    bg: 'bg-green-900',
    bgLight: 'bg-green-700',
    bgHover: 'hover:bg-green-800',
    textLight: 'text-green-300',
    border: 'border-green-800',
  },
  amber: {
    bg: 'bg-amber-900',
    bgLight: 'bg-amber-700',
    bgHover: 'hover:bg-amber-800',
    textLight: 'text-amber-300',
    border: 'border-amber-800',
  },
  indigo: {
    bg: 'bg-indigo-900',
    bgLight: 'bg-indigo-700',
    bgHover: 'hover:bg-indigo-800',
    textLight: 'text-indigo-300',
    border: 'border-indigo-800',
  },
  rose: {
    bg: 'bg-rose-900',
    bgLight: 'bg-rose-700',
    bgHover: 'hover:bg-rose-800',
    textLight: 'text-rose-300',
    border: 'border-rose-800',
  },
};

export default function SharedDashboardLayout({
  children,
  title,
  colorScheme,
  navigation,
  roleLabel,
  additionalLinks,
}: SharedDashboardLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name || '';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const colors = colorSchemes[colorScheme];
  const isActive = (href: string) => {
    if (pathname === href) return true;
    // Avoid false positives: /dashboard shouldn't match /dashboard/events
    if (href === '/dashboard') return false;
    return pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 ${colors.bg} text-white px-4 py-6 md:px-6 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="text-2xl font-bold leading-tight">
            <div>eloop</div>
            <span className={`inline-block mt-1 text-xs font-semibold ${colors.bgLight} px-2 py-1 rounded`}>{roleLabel}</span>
          </div>
          <button
            className="md:hidden text-white/80 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-8 overflow-y-auto pr-1">
          {navigation.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              {section.title && (
                <div className={`px-2 text-[11px] uppercase tracking-widest ${colors.textLight}`}>{section.title}</div>
              )}
              <div className="space-y-2">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-3 rounded-lg transition-colors text-sm font-medium ${isActive(item.href)
                      ? `${colors.bgLight} text-white shadow-sm`
                      : `${colors.bgHover} text-white/90 hover:text-white`
                      }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {additionalLinks}
        </nav>

        <div className={`pt-4 mt-4 border-t ${colors.border}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full ${colors.bgLight} flex items-center justify-center mr-3 text-lg font-semibold`}>
                {userName?.charAt(0) || '?'}
              </div>
              <div>
                <div className="font-semibold leading-tight">{userName || 'User'}</div>
                <div className={`text-xs ${colors.textLight} capitalize`}>{roleLabel}</div>
              </div>
            </div>
          </div>
          <SignOutButton className={`w-full text-left px-3 py-2 rounded-lg ${colors.bgHover} text-red-200 hover:text-red-100`} />
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-72">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className={`md:hidden ${colors.bg} text-white p-2 rounded-md shadow`}
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <p className="text-xs text-slate-500">Dashboard</p>
                <h1 className="text-lg md:text-xl font-semibold text-slate-900">{title}</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-6xl mx-auto w-full space-y-6 md:space-y-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}