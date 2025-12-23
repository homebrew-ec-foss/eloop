import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const resolvedParams = await params;
        const eventId = resolvedParams.id;

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only admins and organizers can toggle team formation
        if (!['admin', 'organizer'].includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Only admins and organizers can toggle team formation status' },
                { status: 403 }
            );
        }

        // Get the event to verify it exists
        const eventResult = await turso.execute({
            sql: 'SELECT is_team_formation_open FROM events WHERE id = ?',
            args: [eventId]
        });

        if (eventResult.rows.length === 0) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { isOpen } = body;

        if (typeof isOpen !== 'boolean') {
            return NextResponse.json(
                { error: 'Invalid request body. Expected { isOpen: boolean }' },
                { status: 400 }
            );
        }

        // Update team formation status
        await turso.execute({
            sql: `
        UPDATE events 
        SET is_team_formation_open = ?, updated_at = ?
        WHERE id = ?
      `,
            args: [isOpen ? 1 : 0, Date.now(), eventId]
        });

        // Fetch updated event
        const updatedEventResult = await turso.execute({
            sql: 'SELECT * FROM events WHERE id = ?',
            args: [eventId]
        });

        const updatedEvent = updatedEventResult.rows[0];

        return NextResponse.json({
            message: `Team formation ${isOpen ? 'opened' : 'closed'} successfully`,
            event: {
                id: updatedEvent.id,
                isTeamFormationOpen: Boolean(updatedEvent.is_team_formation_open)
            }
        });
    } catch (error) {
        console.error('Error toggling team formation:', error);
        return NextResponse.json(
            { error: 'Failed to toggle team formation status' },
            { status: 500 }
        );
    }
}
