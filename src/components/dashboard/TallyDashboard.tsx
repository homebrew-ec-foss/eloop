'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Team {
    id: string;
    name: string;
    memberIds: string[];
}

interface ScoringRound {
    id: string;
    name: string;
}

interface TallyEntry {
    rank: number;
    team: Team;
    totalScore: number;
    scoresByRound: Array<{
        round?: string;
        score?: number;
    }>;
}

interface TallyData {
    event: {
        id: string;
        name: string;
    };
    summary: {
        totalTeams: number;
        totalRounds: number;
        totalParticipants: number;
    };
    leaderboard: TallyEntry[];
    rounds: ScoringRound[];
}

export default function TallyDashboard({ eventId }: { eventId: string }) {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tally, setTally] = useState<TallyData | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Check authorization
    useEffect(() => {
        if (session && session.user.role !== 'organizer' && session.user.role !== 'admin') {
            setError('Only organizers and admins can access this page');
            router.push('/');
        }
    }, [session, router]);

    // Fetch tally data
    useEffect(() => {
        const fetchTally = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/organizer/tally?eventId=${eventId}`);

                if (!res.ok) {
                    throw new Error('Failed to fetch tally');
                }

                const data: TallyData = await res.json();
                setTally(data);
                setError('');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch tally');
            } finally {
                setLoading(false);
            }
        };

        if (eventId) {
            fetchTally();
        }
    }, [eventId]);

    // Auto-refresh every 10 seconds if enabled
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetch(`/api/organizer/tally?eventId=${eventId}`)
                .then((res) => res.json())
                .then((data: TallyData) => setTally(data))
                .catch((err) => console.error('Auto-refresh failed:', err));
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, [autoRefresh, eventId]);

    const handleExportCSV = () => {
        window.open(`/api/admin/export/tally?event_id=${eventId}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="mt-2 text-slate-600">Loading tally...</p>
                </div>
            </div>
        );
    }

    if (!tally) {
        return (
            <div className="p-6 text-center text-slate-600">
                No tally data available
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Final Rankings</p>
                        <h1 className="text-2xl font-semibold text-slate-900">{tally.event.name}</h1>
                        <p className="text-slate-600 mt-1">Team leaderboard and scoring summary</p>
                    </div>
                    <button
                        onClick={handleExportCSV}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-sm shadow-sm transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 p-5 rounded-2xl shadow-sm">
                    <p className="text-indigo-600 text-xs font-semibold uppercase tracking-wide mb-1">Total Teams</p>
                    <p className="text-4xl font-bold text-indigo-700">{tally.summary.totalTeams}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-5 rounded-2xl shadow-sm">
                    <p className="text-emerald-600 text-xs font-semibold uppercase tracking-wide mb-1">Total Participants</p>
                    <p className="text-4xl font-bold text-emerald-700">{tally.summary.totalParticipants}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-5 rounded-2xl shadow-sm">
                    <p className="text-purple-600 text-xs font-semibold uppercase tracking-wide mb-1">Evaluation Rounds</p>
                    <p className="text-4xl font-bold text-purple-700">{tally.summary.totalRounds}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-5 rounded-2xl shadow-sm">
                    <p className="text-amber-600 text-xs font-semibold uppercase tracking-wide mb-1">Auto-Refresh</p>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`mt-2 px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm ${autoRefresh
                            ? 'bg-amber-600 text-white hover:bg-amber-700'
                            : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                            }`}
                    >
                        {autoRefresh ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {/* Main Leaderboard */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <span>🏆</span>
                        Final Rankings
                    </h2>
                </div>

                {tally.leaderboard.length === 0 ? (
                    <div className="p-8 text-center text-slate-600">
                        No teams have been scored yet
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Position</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Team Name</th>
                                    <th className="px-6 py-3 text-center text-sm font-medium text-slate-700">Members</th>
                                    {tally.rounds.map((round) => (
                                        <th key={round.id} className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                                            {round.name}
                                        </th>
                                    ))}
                                    <th className="px-6 py-3 text-right text-sm font-medium text-slate-700">Total Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tally.leaderboard.map((entry) => (
                                    <tr
                                        key={entry.team.id}
                                        className={`border-b border-slate-200 hover:bg-indigo-50 transition ${entry.rank === 1
                                            ? 'bg-amber-50'
                                            : entry.rank === 2
                                                ? 'bg-slate-50'
                                                : entry.rank === 3
                                                    ? 'bg-orange-50'
                                                    : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm">
                                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-slate-900">{entry.team.name}</td>
                                        <td className="px-6 py-4 text-center text-slate-600">
                                            {entry.team.memberIds.length}
                                        </td>
                                        {tally.rounds.map((round) => {
                                            const roundScore = entry.scoresByRound.find((s) => s.round === round.name);
                                            return (
                                                <td key={round.id} className="px-4 py-4 text-center">
                                                    {roundScore && roundScore.score !== undefined ? (
                                                        <span className="inline-block bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                                                            {roundScore.score.toFixed(1)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-xl font-bold text-indigo-600">
                                                {entry.totalScore.toFixed(1)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Top 3 Podium */}
            {tally.leaderboard.length >= 1 && (
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <span>🏅</span>
                        Podium
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {tally.leaderboard.slice(0, 3).map((entry, idx) => (
                            <div
                                key={entry.team.id}
                                className={`p-6 rounded-2xl text-center border-2 shadow-sm ${idx === 0
                                    ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300'
                                    : idx === 1
                                        ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300'
                                        : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300'
                                    }`}
                            >
                                <div className="text-5xl mb-3">
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">{entry.team.name}</h3>
                                <p className="text-slate-600 mb-3 text-sm">{entry.team.memberIds.length} members</p>
                                <p className="text-3xl font-bold text-indigo-600">
                                    {entry.totalScore.toFixed(1)} <span className="text-lg text-slate-600">pts</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
