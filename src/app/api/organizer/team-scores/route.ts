import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { getTeamsWithMembers, getRoundAllScores, getEventLeaderboard, getEventScoringRounds } from '@/lib/db/team';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get('eventId');
        const view = searchParams.get('view'); // 'leaderboard' or 'round'
        const roundId = searchParams.get('roundId'); // required if view is 'round'

        if (!eventId) {
            return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
        }

        // Verify the user is the organizer of this event
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (event.organizerId !== session.user.id && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Not authorized to view this event' }, { status: 403 });
        }

        // Return data based on view type
        if (view === 'round') {
            if (!roundId) {
                return NextResponse.json(
                    { error: 'Round ID is required for round view' },
                    { status: 400 }
                );
            }

            const scores = await getRoundAllScores(roundId);
            return NextResponse.json(scores);
        } else {
            // Default: leaderboard view (overall scores)
            const leaderboard = await getEventLeaderboard(eventId);

            // Get rounds for context
            const rounds = await getEventScoringRounds(eventId);

            return NextResponse.json({
                leaderboard,
                rounds
            });
        }
    } catch (error) {
        console.error('Error fetching team scores:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch team scores' },
            { status: 500 }
        );
    }
}
