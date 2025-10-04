'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession();
  const router = useRouter();

  // Check if user has admin access
  useEffect(() => {
    if (session && session.user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [session, router]);

  if (session?.user?.role !== 'admin') {
    return <div className="p-6">Access denied. Admin privileges required.</div>;
  }

  return (
    <div>
      <div className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h2 className="text-2xl font-bold text-gray-900">Administration</h2>
            <nav className="mt-4">
              <ul className="flex space-x-4 border-b">
                <li className="pb-2">
                  <Link 
                    href="/dashboard/admin/users" 
                    className="text-gray-600 hover:text-blue-500 hover:border-b-2 hover:border-blue-500 px-1 pb-2"
                  >
                    Manage Users
                  </Link>
                </li>
                <li className="pb-2">
                  <Link 
                    href="/dashboard/admin/applicants" 
                    className="text-gray-600 hover:text-blue-500 hover:border-b-2 hover:border-blue-500 px-1 pb-2"
                  >
                    Approve Applicants
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}