'use client';

import { useEffect, useState } from 'react';
import { UserProfile, UserRole } from '@/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function VolunteersManagePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if user has organizer access
  useEffect(() => {
    if (session && session.user?.role !== 'admin' && session.user?.role !== 'organizer') {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Fetch participants and volunteers
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/organizer/users');
        
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        
        const data = await response.json();
        setUsers(data.users);
      } catch (err) {
        setError('Error loading users: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user?.role === 'admin' || session?.user?.role === 'organizer') {
      fetchUsers();
    }
  }, [session]);

  // Promote user to volunteer
  const promoteToVolunteer = async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const response = await fetch('/api/volunteer/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to promote user to volunteer');
      }
      
      const { user: updatedUser } = await response.json();
      
      // Update users array
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === updatedUser.id ? updatedUser : user
        )
      );
      
      setSuccessMessage(`User ${updatedUser.name} promoted to volunteer`);
    } catch (err) {
      setError('Error promoting user: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'organizer': return 'bg-blue-500';
      case 'volunteer': return 'bg-green-500';
      case 'participant': return 'bg-teal-500';
      case 'applicant': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  // Filter users who are applicants, participants, or volunteers
  const filteredUsers = users.filter(user => 
    user.role === 'applicant' ||
    user.role === 'participant' || 
    (user.role === 'volunteer' && 
     (user.organizerId === session?.user?.id || session?.user?.role === 'admin'))
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User & Volunteer Management</h1>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-sm">
          <strong>Promote users to volunteers:</strong> Select applicants or participants below and promote them to volunteer status. 
          Volunteers can help with event check-ins and other tasks.
        </p>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {isLoading && <div className="text-gray-500">Loading users...</div>}
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {(user.role === 'applicant' || user.role === 'participant') && (
                    <button 
                      onClick={() => promoteToVolunteer(user.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                      disabled={isLoading}
                    >
                      Promote to Volunteer
                    </button>
                  )}
                  {user.role === 'volunteer' && (
                    <span className="text-gray-500">Already a volunteer</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredUsers.length === 0 && !isLoading && (
        <div className="text-center py-10">
          <p className="text-gray-500">No applicants, participants, or volunteers found.</p>
        </div>
      )}
    </div>
  );
}