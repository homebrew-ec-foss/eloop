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
  colorScheme: 'purple' | 'blue' | 'teal' | 'green' | 'amber';
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm flex-shrink-0">
          <div className="px-4 py-3 md:px-6 md:py-4 flex justify-between items-center">
            <h1 className="text-lg md:text-xl font-semibold text-gray-800">{title}</h1>
            
            {/* Mobile menu button - inline in header */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`md:hidden ${colors.bg} text-white p-2 rounded-md`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>

      {/* Dashboard Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-40 w-64 ${colors.bg} text-white p-4 md:p-6 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0 ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="mb-8">
          <Link href={`/${roleLabel.toLowerCase()}/dashboard`} className="text-2xl font-bold" onClick={() => setIsMobileMenuOpen(false)}>
            eloop <span className={`text-sm ${colors.bgLight} text-white px-2 py-1 rounded`}>{roleLabel}</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1">
          {navigation.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && (
                <div className={`py-2 px-3 mb-2 ${sectionIndex > 0 ? 'mt-6' : ''} ${colors.textLight} text-xs uppercase font-medium`}>
                  {section.title}
                </div>
              )}
              {!section.title && sectionIndex > 0 && (
                <div className="mt-6"></div>
              )}
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block py-2 px-3 rounded ${colors.bgHover}${
                    pathname === item.href ? ` ${colors.bgLight}` : ''
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}

          {/* Additional links (like role switching) */}
          {additionalLinks}

          {/* Sign out */}
          <div className="mt-2">
            <SignOutButton className={`block w-full text-left py-2 px-3 rounded ${colors.bgHover} text-red-300`} />
          </div>
        </nav>

        <div className={`pt-6 mt-6 border-t ${colors.border}`}>
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full ${colors.bgLight} flex items-center justify-center mr-2`}>
              {userName?.charAt(0)}
            </div>
            <div>
              <div className="font-medium">{userName}</div>
              <div className={`text-xs ${colors.textLight} capitalize`}>{roleLabel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}