'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function TestAuthPage() {
  const { data: session, status } = useSession();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Auth Test Page</h1>
      
      <div className="bg-white p-6 rounded-lg shadow mb-4">
        <h2 className="text-xl font-semibold mb-4">Session Status</h2>
        <p className="mb-2"><strong>Status:</strong> {status}</p>
        
        {status === 'loading' && (
          <p className="text-gray-600">Loading session...</p>
        )}
        
        {status === 'unauthenticated' && (
          <div>
            <p className="text-red-600 mb-4">Not authenticated</p>
            <Link href="/auth/signin" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Sign In
            </Link>
          </div>
        )}
        
        {status === 'authenticated' && session && (
          <div>
            <p className="text-green-600 mb-4">Authenticated!</p>
            <div className="bg-gray-50 p-4 rounded">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(session, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
        <div className="space-y-2">
          <p><strong>NEXTAUTH_URL:</strong> {process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'Not set publicly'}</p>
          <p className="text-sm text-gray-600">Note: Server-side env vars will not show here</p>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
