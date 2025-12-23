import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { getRegistrationByQRCode } from '@/lib/db/registration';
import { createTeam, getTeamByMemberRegistration, getEventTeams } from '@/lib/db/team';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is a mentor or organizer
        if (session.user.role !== 'mentor' && session.user.role !== 'organizer' && session.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Only mentors and organizers can create teams' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { eventId, teamName, qrCodes } = body;

        if (!eventId || !teamName || !qrCodes || qrCodes.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: eventId, teamName, and at least 1 qrCode' },
                { status: 400 }
            );
        }

        // Verify the event exists
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Get registrations for each QR code and extract user IDs
        const memberIds: string[] = [];
        const usedUserIds = new Set<string>();

        for (const qrCode of qrCodes) {
            const registration = await getRegistrationByQRCode(qrCode);
            if (!registration) {
                return NextResponse.json(
                    { error: `QR code not found or invalid: ${qrCode}` },
                    { status: 404 }
                );
            }

            // Verify the registration is for the correct event
            if (registration.eventId !== eventId) {
                return NextResponse.json(
                    { error: `QR code does not belong to this event` },
                    { status: 400 }
                );
            }

            // Check if this user is already in another team for this event
            const existingTeam = await getTeamByMemberRegistration(registration.id);
            if (existingTeam) {
                return NextResponse.json(
                    { error: `User from QR code is already in team: ${existingTeam.name}` },
                    { status: 400 }
                );
            }

            // Check for duplicate users in the same request
            if (usedUserIds.has(registration.userId)) {
                return NextResponse.json(
                    { error: 'Cannot add the same user twice to a team' },
                    { status: 400 }
                );
            }

            memberIds.push(registration.userId);
            usedUserIds.add(registration.userId);
        }

        // Create the team
        const team = await createTeam(eventId, teamName, memberIds, session.user.id);

        return NextResponse.json(team, { status: 201 });
    } catch (error) {
        console.error('Error creating team:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create team' },
            { status: 500 }
        );
    }
}

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

        // Verify the event exists
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Get all teams for the event
        const teams = await getEventTeams(eventId);
        return NextResponse.json(teams);
    } catch (error) {
        console.error('Error fetching teams:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch teams' },
            { status: 500 }
        );
    }
}
