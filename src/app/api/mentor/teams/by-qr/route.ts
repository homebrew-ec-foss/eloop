import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { getRegistrationByQRCode } from '@/lib/db/registration';
import { getTeamByMemberRegistration } from '@/lib/db/team';
import { getUserById } from '@/lib/db/user';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get('eventId');
        const qrCode = searchParams.get('qrCode');

        if (!eventId || !qrCode) {
            return NextResponse.json(
                { error: 'Missing required parameters: eventId and qrCode' },
                { status: 400 }
            );
        }

        // Verify the event exists
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Get registration for this QR code
        const registration = await getRegistrationByQRCode(qrCode);
        if (!registration) {
            return NextResponse.json(
                { error: 'QR code not found' },
                { status: 404 }
            );
        }

        // Verify the registration is for the correct event
        if (registration.eventId !== eventId) {
            return NextResponse.json(
                { error: 'QR code does not belong to this event' },
                { status: 400 }
            );
        }

        // Get user information
        const user = await getUserById(registration.userId);
        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get team information
        const team = await getTeamByMemberRegistration(registration.id);

        return NextResponse.json({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            teamId: team?.id,
            teamName: team?.name,
            hasTeam: !!team
        });
    } catch (error) {
        console.error('Error fetching team by QR:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch team information' },
            { status: 500 }
        );
    }
}
