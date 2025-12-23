import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { createScoringRound, getEventScoringRounds, deleteScoringRound, getScoringRoundById } from '@/lib/db/team';

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

        // Verify the user is the organizer of this event, or a mentor/admin
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Allow organizers, mentors, and admins to view scoring rounds
        if (event.organizerId !== session.user.id && session.user.role !== 'admin' && session.user.role !== 'mentor') {
            return NextResponse.json({ error: 'Not authorized to view this event' }, { status: 403 });
        }

        // Get all scoring rounds for the event
        const rounds = await getEventScoringRounds(eventId);
        return NextResponse.json(rounds);
    } catch (error) {
        console.error('Error fetching scoring rounds:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch scoring rounds' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { eventId, name, roundNumber, action } = body;

        if (!eventId || !name || roundNumber === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: eventId, name, roundNumber' },
                { status: 400 }
            );
        }

        // Verify the user is the organizer of this event
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (event.organizerId !== session.user.id && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Not authorized to manage this event' }, { status: 403 });
        }

        if (action === 'create') {
            // Create a new scoring round
            const round = await createScoringRound(
                eventId,
                name,
                roundNumber
            );
            return NextResponse.json(round, { status: 201 });
        } else if (action === 'delete') {
            // Delete a scoring round
            const { roundId } = body;
            if (!roundId) {
                return NextResponse.json({ error: 'Round ID is required for deletion' }, { status: 400 });
            }

            // Verify the round belongs to this event
            const round = await getScoringRoundById(roundId);
            if (!round || round.eventId !== eventId) {
                return NextResponse.json({ error: 'Round not found or does not belong to this event' }, { status: 404 });
            }

            await deleteScoringRound(roundId);
            return NextResponse.json({ success: true, message: 'Round deleted successfully' });
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "create" or "delete"' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error managing scoring rounds:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to manage scoring rounds' },
            { status: 500 }
        );
    }
}
