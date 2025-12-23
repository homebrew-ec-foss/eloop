'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'organizer' | 'volunteer' | 'participant' | 'applicant' | 'mentor';
    createdAt: string;
    updatedAt: string;
}

export default function MentorManagementClient() {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [mentors, setMentors] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'all' | 'mentors'>('all');

    // Check authorization
    useEffect(() => {
        if (session && session.user.role !== 'admin' && session.user.role !== 'organizer') {
            setError('Only admins and organizers can access this page');
            router.push('/');
        }
    }, [session, router]);

    // Fetch users and mentors
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [allUsersRes, mentorsRes] = await Promise.all([
                    fetch('/api/admin/promote-mentor'),
                    fetch('/api/admin/promote-mentor?role=mentor')
                ]);

                if (!allUsersRes.ok || !mentorsRes.ok) {
                    throw new Error('Failed to fetch users');
                }

                const allUsersData: User[] = await allUsersRes.json();
                const mentorsData: User[] = await mentorsRes.json();

                setAllUsers(allUsersData);
                setMentors(mentorsData);
                setFilteredUsers(allUsersData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch users');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter users based on search and view
    useEffect(() => {
        let filtered = view === 'all' ? allUsers : mentors;

        if (searchTerm.trim()) {
            filtered = filtered.filter(
                (user) =>
                    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredUsers(filtered);
    }, [searchTerm, view, allUsers, mentors]);

    // Handle promoting user to mentor
    const handlePromoteToMentor = async (userId: string) => {
        try {
            const res = await fetch('/api/admin/promote-mentor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    action: 'promote'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to promote user');
            }

            // Refresh data
            const allUsersRes = await fetch('/api/admin/promote-mentor');
            const mentorsRes = await fetch('/api/admin/promote-mentor?role=mentor');
            const allUsersData: User[] = await allUsersRes.json();
            const mentorsData: User[] = await mentorsRes.json();

            setAllUsers(allUsersData);
            setMentors(mentorsData);
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to promote user');
        }
    };

    // Handle demoting mentor to participant
    const handleDemoteFromMentor = async (userId: string) => {
        if (!confirm('Are you sure you want to remove mentor status?')) {
            return;
        }

        try {
            const res = await fetch('/api/admin/promote-mentor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    action: 'demote'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to demote user');
            }

            // Refresh data
            const allUsersRes = await fetch('/api/admin/promote-mentor');
            const mentorsRes = await fetch('/api/admin/promote-mentor?role=mentor');
            const allUsersData: User[] = await allUsersRes.json();
            const mentorsData: User[] = await mentorsRes.json();

            setAllUsers(allUsersData);
            setMentors(mentorsData);
            setError('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to demote user');
        }
    };

    if (loading) {
        return <div className="p-6">Loading...</div>;
    }

    // Get role badge color matching admin users page
    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-500';
            case 'organizer': return 'bg-blue-500';
            case 'mentor': return 'bg-indigo-500';
            case 'volunteer': return 'bg-teal-500';
            case 'participant': return 'bg-green-500';
            case 'applicant': return 'bg-amber-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="space-y-6 md:space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Management</p>
                        <h1 className="text-2xl font-semibold text-slate-900">Mentor Management</h1>
                        <p className="text-slate-600 mt-1">Search, filter, and manage mentor roles without leaving this page.</p>
                    </div>
                    <div className="w-full md:w-72">
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search name or email"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setView('all')}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition ${view === 'all'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200'
                            }`}
                    >
                        All users ({allUsers.length})
                    </button>
                    <button
                        onClick={() => setView('mentors')}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition ${view === 'mentors'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200'
                            }`}
                    >
                        Mentors ({mentors.length})
                    </button>
                </div>
            </div>

            {loading && <div className="text-slate-500 text-sm">Loading users...</div>}

            <div className="hidden sm:block overflow-x-auto">
                <div className="min-w-full bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <table className="min-w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Name</th>
                                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Email</th>
                                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Role</th>
                                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Joined</th>
                                <th className="px-6 py-3 text-left text-xs uppercase tracking-wide font-medium text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full text-white ${getRoleBadgeColor(user.role)}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {user.role === 'admin' ? (
                                            <span className="text-slate-500 text-xs">N/A</span>
                                        ) : user.role === 'mentor' ? (
                                            <button
                                                onClick={() => handleDemoteFromMentor(user.id)}
                                                className="text-rose-600 hover:text-rose-800 font-medium"
                                            >
                                                Remove Mentor
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handlePromoteToMentor(user.id)}
                                                className="text-indigo-600 hover:text-indigo-800 font-medium"
                                            >
                                                Promote to Mentor
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
                {filteredUsers.map(user => (
                    <div key={user.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                        <div>
                            <h3 className="font-semibold text-slate-900">{user.name}</h3>
                            <p className="text-sm text-slate-600">{user.email}</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full text-white ${getRoleBadgeColor(user.role)}`}>
                                    {user.role}
                                </span>
                                <p className="text-xs text-slate-500 mt-1">
                                    Joined {new Date(user.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            {user.role === 'admin' ? (
                                <span className="text-slate-500 text-xs">N/A</span>
                            ) : user.role === 'mentor' ? (
                                <button
                                    onClick={() => handleDemoteFromMentor(user.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                                >
                                    Remove
                                </button>
                            ) : (
                                <button
                                    onClick={() => handlePromoteToMentor(user.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                >
                                    Promote
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
