import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { getRegistrationByQRCode, getRegistrationById } from '@/lib/db/registration';
import { getTeamByMemberRegistration, getEventTeams } from '@/lib/db/team';
import { getUserById } from '@/lib/db/user';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { eventId, qrCode, currentTeamMembers } = body;

        if (!eventId || !qrCode) {
            return NextResponse.json(
                { error: 'Missing required fields: eventId and qrCode' },
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
                { error: 'QR code not found or invalid' },
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

        // Check if this user is already in another team for this event
        const existingTeam = await getTeamByMemberRegistration(registration.id);
        if (existingTeam) {
            return NextResponse.json(
                {
                    error: `${user.name} is already in team: ${existingTeam.name}`,
                    userId: user.id,
                    userName: user.name,
                    alreadyInTeam: true,
                    teamName: existingTeam.name
                },
                { status: 400 }
            );
        }

        // Check if user is already in current team (duplicate scan)
        if (currentTeamMembers && currentTeamMembers.includes(registration.userId)) {
            return NextResponse.json(
                {
                    error: `${user.name} has already been scanned for this team`,
                    userId: user.id,
                    userName: user.name,
                    alreadyScanned: true
                },
                { status: 400 }
            );
        }

        // Success - return user information
        return NextResponse.json({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            registrationId: registration.id,
            valid: true
        });
    } catch (error) {
        console.error('Error validating QR code:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to validate QR code' },
            { status: 500 }
        );
    }
}
