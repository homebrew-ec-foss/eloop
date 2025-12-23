import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { getEventLeaderboard, getEventScoringRounds } from '@/lib/db/team';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get('eventId');

        if (!eventId) {
            return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
        }

        // Verify the user is the organizer of this event or admin
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (event.organizerId !== session.user.id && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Not authorized to view this event' }, { status: 403 });
        }

        // Get leaderboard data
        const leaderboard = await getEventLeaderboard(eventId);
        const rounds = await getEventScoringRounds(eventId);

        // Create tally summary
        const tally = {
            event: {
                id: event.id,
                name: event.name
            },
            summary: {
                totalTeams: leaderboard.length,
                totalRounds: rounds.length,
                totalParticipants: leaderboard.reduce(
                    (sum, entry) => sum + entry.team.memberIds.length,
                    0
                )
            },
            leaderboard: leaderboard.map((entry) => ({
                rank: leaderboard.indexOf(entry) + 1,
                team: entry.team,
                totalScore: entry.totalScore,
                scoresByRound: entry.scores.map((score) => ({
                    round: rounds.find((r) => r.id === score.scoringRoundId)?.name,
                    score: score.score
                }))
            })),
            rounds
        };

        return NextResponse.json(tally);
    } catch (error) {
        console.error('Error fetching tally:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch tally' },
            { status: 500 }
        );
    }
}
