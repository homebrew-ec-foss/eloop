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

  // Get role badge colors
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-rose-100 text-rose-700';
      case 'organizer': return 'bg-indigo-100 text-indigo-700';
      case 'volunteer': return 'bg-emerald-100 text-emerald-700';
      case 'participant': return 'bg-teal-100 text-teal-700';
      case 'applicant': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
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
    <div className="space-y-6">
      <div className="mx-6 pt-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User & Volunteer Management</h1>
          <p className="text-slate-500 mt-1">Manage participants and promote volunteers</p>
        </div>
      </div>

      <div className="mx-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
        <p className="text-indigo-900 text-sm">
          <strong>Promote to Volunteer:</strong> Select applicants or participants to promote them to volunteer status. Volunteers assist with event check-ins and tasks.
        </p>
      </div>

      {error && (
        <div className="mx-6 bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-xl">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mx-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-4 rounded-xl">
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {isLoading ? (
        <div className="mx-6 text-slate-500">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="mx-6 bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-500">No applicants, participants, or volunteers found.</p>
        </div>
      ) : (
        <div className="mx-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Email</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Role</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {(user.role === 'applicant' || user.role === 'participant') && (
                        <button
                          onClick={() => promoteToVolunteer(user.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-xs transition-colors disabled:opacity-50"
                          disabled={isLoading}
                        >
                          Promote
                        </button>
                      )}
                      {user.role === 'volunteer' && (
                        <span className="text-xs text-slate-500 font-medium">Volunteer</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-4">
            {filteredUsers.map(user => (
              <div key={user.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-slate-900">{user.name}</h3>
                    <p className="text-sm text-slate-600">{user.email}</p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
                {(user.role === 'applicant' || user.role === 'participant') && (
                  <button
                    onClick={() => promoteToVolunteer(user.id)}
                    className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Promote to Volunteer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}