"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import UserRegistrationsSection from '@/components/dashboard/UserRegistrationsSection';

export default function AdminViewAsPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error('Failed to load users for view-as:', err);
      }
    };

    if (session?.user?.role === 'admin') fetchUsers();
  }, [session]);

  if (!session?.user || session.user.role !== 'admin') {
    return <div className="p-6">Unauthorized</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin: View As User</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select user</label>
        <select value={selectedUser ?? ''} onChange={e => setSelectedUser(e.target.value || null)} className="border rounded p-2">
          <option value="">-- pick user --</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
          ))}
        </select>
      </div>

      {selectedUser ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">Preview as selected user</h2>
          <UserRegistrationsSection viewAsUserId={selectedUser} />
        </div>
      ) : (
        <div className="text-gray-600">Choose a user to preview their participant view.</div>
      )}
    </div>
  );
}
