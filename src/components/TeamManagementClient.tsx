'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GenericQRScanner } from './qr/GenericQRScanner';

interface Team {
    id: string;
    eventId: string;
    name: string;
    memberIds: string[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

interface ScoringRound {
    id: string;
    eventId: string;
    name: string;
    roundNumber: number;
    createdAt: string;
    updatedAt: string;
}

interface ScannedMember {
    qrCode: string;
    userName: string;
    userId: string;
}

interface Event {
    id: string;
    isTeamFormationOpen?: boolean;
}

export default function TeamManagementClient({ eventId }: { eventId: string }) {
    const { data: session } = useSession();
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [rounds, setRounds] = useState<ScoringRound[]>([]);
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'form' | 'grade'>('form'); // Toggle between form and grade modes

    // Form mode state
    const [scannedQRs, setScannedQRs] = useState<string[]>([]);
    const [scannedMembers, setScannedMembers] = useState<ScannedMember[]>([]);
    const [teamName, setTeamName] = useState('');
    const [showScanner, setShowScanner] = useState(false);

    // Grade mode state
    const [selectedRound, setSelectedRound] = useState('');
    const [score, setScore] = useState('');
    const [notes, setNotes] = useState('');
    const [gradingQRCode, setGradingQRCode] = useState('');
    const [gradingMemberName, setGradingMemberName] = useState('');
    const [gradingTeamName, setGradingTeamName] = useState('');
    const [showGradeScanner, setShowGradeScanner] = useState(false);

    // Check authorization
    useEffect(() => {
        if (session && session.user.role !== 'mentor' && session.user.role !== 'organizer' && session.user.role !== 'admin') {
            setError('Only mentors and organizers can access this page');
            router.push('/');
        }
    }, [session, router]);

    // Fetch teams and scoring rounds
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [teamsRes, roundsRes, eventRes] = await Promise.all([
                    fetch(`/api/mentor/teams?eventId=${eventId}`),
                    fetch(`/api/organizer/scoring-rounds?eventId=${eventId}`),
                    fetch(`/api/events/${eventId}`)
                ]);

                if (!teamsRes.ok || !roundsRes.ok || !eventRes.ok) {
                    throw new Error('Failed to fetch data');
                }

                const teamsData = await teamsRes.json();
                const roundsData = await roundsRes.json();
                const eventData = await eventRes.json();

                setTeams(teamsData);
                setRounds(roundsData);
                setEvent(eventData.event);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    // Handle QR code scans during team formation
    const handleQRScan = async (qrValue: string) => {
        // Check for duplicate in current team
        if (scannedQRs.includes(qrValue)) {
            setError('This QR code has already been scanned for this team');
            return;
        }

        try {
            // Validate QR code and get user info
            const memberUserIds = scannedMembers.map(m => m.userId);
            const res = await fetch('/api/mentor/teams/validate-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    qrCode: qrValue,
                    currentTeamMembers: memberUserIds
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to validate QR code');
                return;
            }

            // Add to scanned lists
            setScannedQRs([...scannedQRs, qrValue]);
            setScannedMembers([...scannedMembers, {
                qrCode: qrValue,
                userName: data.userName,
                userId: data.userId
            }]);
            setError('');

            // Close scanner if we have 4 QR codes
            if (scannedQRs.length + 1 === 4) {
                setShowScanner(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to validate QR code');
        }
    };

    // Handle grading QR scan
    const handleGradeQRScan = async (qrValue: string) => {
        setGradingQRCode(qrValue);
        setShowGradeScanner(false);
        setError('');

        // Fetch member and team info
        try {
            const res = await fetch(`/api/mentor/teams/by-qr?eventId=${eventId}&qrCode=${encodeURIComponent(qrValue)}`);

            if (!res.ok) {
                const errorData = await res.json();
                setError(errorData.error || 'Failed to fetch member information');
                setGradingMemberName('');
                setGradingTeamName('');
                return;
            }

            const data = await res.json();
            setGradingMemberName(data.userName || 'Unknown');
            setGradingTeamName(data.teamName || 'No team assigned');
        } catch (err) {
            console.error('Error fetching member info:', err);
            setError('Failed to fetch member information');
            setGradingMemberName('');
            setGradingTeamName('');
        }
    };

    // Submit team creation
    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();

        if (scannedQRs.length === 0) {
            setError('Must scan at least 1 QR code');
            return;
        }

        if (!teamName.trim()) {
            setError('Team name is required');
            return;
        }

        try {
            const res = await fetch('/api/mentor/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    teamName,
                    qrCodes: scannedQRs
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create team');
            }

            // Reset form
            setScannedQRs([]);
            setScannedMembers([]);
            setTeamName('');
            setShowScanner(false);
            setError('');

            // Refresh teams
            const teamsRes = await fetch(`/api/mentor/teams?eventId=${eventId}`);
            const teamsData = await teamsRes.json();
            setTeams(teamsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create team');
        }
    };

    // Submit team grading
    const handleGradeTeam = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!gradingQRCode) {
            setError('Must scan a QR code');
            return;
        }

        if (!selectedRound) {
            setError('Must select a scoring round');
            return;
        }

        if (score === '' || isNaN(Number(score))) {
            setError('Score must be a valid number');
            return;
        }


        try {
            const res = await fetch('/api/mentor/teams/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    qrCode: gradingQRCode,
                    scoringRoundId: selectedRound,
                    score: Number(score),
                    notes: notes || undefined
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to grade team');
            }

            // Reset form
            setGradingQRCode('');
            setGradingMemberName('');
            setGradingTeamName('');
            setSelectedRound('');
            setScore('');
            setNotes('');
            setShowGradeScanner(false);
            setError('');

            alert('Team graded successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to grade team');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
                    <p className="mt-2 text-slate-600">Loading team data...</p>
                </div>
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

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Management</p>
                        <h1 className="text-2xl font-semibold text-slate-900">Team Management</h1>
                        <p className="text-slate-600 mt-1">Form teams and manage team grading</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setMode('form')}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition ${mode === 'form'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-rose-200'
                            }`}
                    >
                        Form Teams
                    </button>
                    <button
                        onClick={() => setMode('grade')}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition ${mode === 'grade'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-rose-200'
                            }`}
                    >
                        Grade Teams
                    </button>
                </div>
            </div>

            {mode === 'form' ? (
                // Team Formation Mode
                session?.user?.role === 'mentor' && !event?.isTeamFormationOpen ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-xl">
                        <h3 className="font-semibold mb-2">Team Formation Closed</h3>
                        <p>Team formation is currently disabled. Please ask the organizer to enable it.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-6">
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Team</h2>

                                <form onSubmit={handleCreateTeam} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Team Name / (Table Number)</label>
                                        <input
                                            type="text"
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            placeholder="Enter team name"
                                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                            disabled={scannedQRs.length === 4}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Scanned Team Members ({scannedMembers.length})
                                        </label>
                                        <div className="space-y-2 mb-4">
                                            {scannedMembers.map((member, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl">
                                                    <div>
                                                        <span className="text-sm font-medium text-slate-900">{idx + 1}. {member.userName}</span>
                                                        <span className="text-xs text-slate-500 ml-2">({member.qrCode.substring(0, 15)}...)</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setScannedQRs(scannedQRs.filter((_, i) => i !== idx));
                                                            setScannedMembers(scannedMembers.filter((_, i) => i !== idx));
                                                        }}
                                                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {!showScanner ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowScanner(true)}
                                                className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-sm shadow-sm transition"
                                            >
                                                Scan QR Code
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                <GenericQRScanner
                                                    onScan={handleQRScan}
                                                    isActive={showScanner}
                                                    scannerTitle="Scan Team Member QR Code"
                                                    scannerDescription="Scan team members' QR codes to add them to the team"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowScanner(false)}
                                                    className="w-full px-4 py-2.5 bg-slate-600 text-white rounded-xl hover:bg-slate-700 font-medium text-sm shadow-sm transition"
                                                >
                                                    Stop Scanner
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={scannedQRs.length === 0 || !teamName.trim()}
                                        className="w-full px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium text-sm shadow-sm transition"
                                    >
                                        Create Team
                                    </button>
                                </form>
                            </div>

                            {/* Teams List */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Existing Teams ({teams.length})</h2>
                                {teams.length === 0 ? (
                                    <p className="text-slate-600 text-center py-8">No teams created yet</p>
                                ) : (
                                    <div className="space-y-3">
                                        {teams.map((team) => (
                                            <div key={team.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                                                <h3 className="font-semibold text-slate-900">{team.name}</h3>
                                                <p className="text-sm text-slate-600 mt-1">Members: {team.memberIds.length}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )
            ) : (
                // Team Grading Mode
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Grade Team</h2>

                    {rounds.length === 0 ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                            No scoring rounds available. Ask the organizer to create rounds first.
                        </div>
                    ) : (
                        <form onSubmit={handleGradeTeam} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Scoring Round</label>
                                <select
                                    value={selectedRound}
                                    onChange={(e) => setSelectedRound(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                >
                                    <option value="">Select a round...</option>
                                    {rounds.map((round) => (
                                        <option key={round.id} value={round.id}>
                                            {round.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Team Member QR Code</label>
                                <div className="space-y-2">
                                    {gradingQRCode && (
                                        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                                            <div className="space-y-2">
                                                {gradingTeamName && (
                                                    <div>
                                                        <span className="text-xs text-slate-500 font-medium">Team:</span>
                                                        <p className="text-base font-semibold text-rose-600">{gradingTeamName}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setGradingQRCode('');
                                                    setGradingMemberName('');
                                                    setGradingTeamName('');
                                                }}
                                                className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                                            >
                                                Clear and Scan Again
                                            </button>
                                        </div>
                                    )}
                                    {!gradingQRCode && !showGradeScanner && (
                                        <button
                                            type="button"
                                            onClick={() => setShowGradeScanner(true)}
                                            className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-sm shadow-sm transition"
                                        >
                                            Scan Team Member QR Code
                                        </button>
                                    )}
                                    {!gradingQRCode && showGradeScanner && (
                                        <div className="space-y-2">
                                            <GenericQRScanner
                                                onScan={handleGradeQRScan}
                                                isActive={showGradeScanner}
                                                scannerTitle="Scan Team Member QR Code"
                                                scannerDescription="Scan any team member's QR code to grade the team"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowGradeScanner(false)}
                                                className="w-full px-4 py-2.5 bg-slate-600 text-white rounded-xl hover:bg-slate-700 font-medium text-sm shadow-sm transition"
                                            >
                                                Stop Scanner
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Score</label>
                                <input
                                    type="number"
                                    value={score}
                                    onChange={(e) => setScore(e.target.value)}
                                    placeholder="Enter score"
                                    step="0.1"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                />
                            </div>



                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any comments about the team's performance"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                    rows={3}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={!gradingQRCode || !selectedRound || score === ''}
                                className="w-full px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium text-sm shadow-sm transition"
                            >
                                Submit Grade
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
