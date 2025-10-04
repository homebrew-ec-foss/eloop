'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect from removed admin setup to user management
export default function AdminSetupRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to user management page
    router.replace('/dashboard/admin/users');
  }, [router]);
  
  return (
    <div className="p-6">
      <p>Redirecting to user management...</p>
    </div>
  );
}
