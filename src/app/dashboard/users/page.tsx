'use client';

import { useEffect, useState } from 'react';
import { UserProfile, UserRole } from '@/types';
import { useSearchParams } from 'next/navigation';

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('participant');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'applicant' | UserRole>(filterParam === 'unapproved' ? 'applicant' : filterParam === 'applicant' ? 'applicant' : 'all');

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users');
        
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

    fetchUsers();
  }, []);

  // Filter users based on role filter
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    const byRole = roleFilter === 'all' ? users : users.filter(user => user.role === roleFilter);
    if (!q) {
      setFilteredUsers(byRole);
      return;
    }

    setFilteredUsers(byRole.filter(user => {
      return (user.name || '').toLowerCase().includes(q) || (user.email || '').toLowerCase().includes(q);
    }));
  }, [users, roleFilter, searchQuery]);

  // Update user role
  const updateUserRole = async (userId: string, role: UserRole) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user role');
      }
      
      const { user: updatedUser } = await response.json();
      
      // Update users array
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === updatedUser.id ? updatedUser : user
        )
      );
      
      setSuccessMessage(`User ${updatedUser.name} role updated to ${updatedUser.role}`);
      setEditingUser(null);
    } catch (err) {
      setError('Error updating user: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle role change
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value as UserRole);
  };

  // Get role badge color
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-purple-500';
      case 'organizer': return 'bg-blue-500';
      case 'volunteer': return 'bg-teal-500';
      case 'participant': return 'bg-green-500';
      case 'applicant': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      
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
      
      {/* Search + Filter Buttons */}
      <div className="mb-4">
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name or email"
          className="w-full sm:w-1/2 border border-gray-300 rounded-md p-2 mb-3 sm:mb-0"
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setRoleFilter('all')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            roleFilter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Users ({users.length})
        </button>
        <button
          onClick={() => setRoleFilter('applicant')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            roleFilter === 'applicant'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Applicants ({users.filter(u => u.role === 'applicant').length})
        </button>
        <button
          onClick={() => setRoleFilter('participant')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            roleFilter === 'participant'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Participants ({users.filter(u => u.role === 'participant').length})
        </button>
        <button
          onClick={() => setRoleFilter('organizer')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            roleFilter === 'organizer'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Organizers ({users.filter(u => u.role === 'organizer').length})
        </button>
        <button
          onClick={() => setRoleFilter('volunteer')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            roleFilter === 'volunteer'
              ? 'bg-teal-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Volunteers ({users.filter(u => u.role === 'volunteer').length})
        </button>
        <button
          onClick={() => setRoleFilter('admin')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            roleFilter === 'admin'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Admins ({users.filter(u => u.role === 'admin').length})
        </button>
      </div>
      
      {isLoading && <div className="text-gray-500">Loading users...</div>}
      
      {/* Desktop/table view (sm and up) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Created</th>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {editingUser === user.id ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedRole}
                        onChange={handleRoleChange}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="applicant">Applicant</option>
                        <option value="participant">Participant</option>
                        <option value="volunteer">Volunteer</option>
                        <option value="organizer">Organizer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => updateUserRole(user.id, selectedRole)}
                        className="bg-purple-600 text-white px-2 py-1 rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="bg-gray-300 text-gray-700 px-2 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setSelectedRole(user.role);
                          setEditingUser(user.id);
                        }}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        Change Role
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete user ${user.name} <${user.email}>? This action cannot be undone.`)) return;
                          try {
                            setIsLoading(true);
                            setError(null);
                            const res = await fetch('/api/admin/users', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: user.id }),
                            });
                            if (!res.ok) {
                              const err = await res.json();
                              throw new Error(err?.error || 'Failed to delete user');
                            }
                            // Remove from UI
                            setUsers(prev => prev.filter(u => u.id !== user.id));
                            setSuccessMessage(`User ${user.name} deleted`);
                          } catch (err) {
                            setError('Error deleting user: ' + (err instanceof Error ? err.message : String(err)));
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile/card view (below sm) */}
      <div className="sm:hidden space-y-3">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full text-white ${getRoleBadgeColor(user.role)}`}>{user.role}</span>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</div>
                <div className="mt-3">
                  {editingUser === user.id ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedRole}
                        onChange={handleRoleChange}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="applicant">Applicant</option>
                        <option value="participant">Participant</option>
                        <option value="volunteer">Volunteer</option>
                        <option value="organizer">Organizer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => updateUserRole(user.id, selectedRole)}
                        className="bg-purple-600 text-white px-2 py-1 rounded text-sm"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end space-y-2">
                      <button
                        onClick={() => {
                          setSelectedRole(user.role);
                          setEditingUser(user.id);
                        }}
                        className="text-purple-600 hover:text-purple-900 text-sm"
                      >
                        Change Role
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete user ${user.name} <${user.email}>? This action cannot be undone.`)) return;
                          try {
                            setIsLoading(true);
                            setError(null);
                            const res = await fetch('/api/admin/users', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: user.id }),
                            });
                            if (!res.ok) {
                              const err = await res.json();
                              throw new Error(err?.error || 'Failed to delete user');
                            }
                            setUsers(prev => prev.filter(u => u.id !== user.id));
                            setSuccessMessage(`User ${user.name} deleted`);
                          } catch (err) {
                            setError('Error deleting user: ' + (err instanceof Error ? err.message : String(err)));
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && !isLoading && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No {roleFilter === 'all' ? '' : roleFilter + ' '}users found.
          </div>
        )}
      </div>
    </div>
  );
}