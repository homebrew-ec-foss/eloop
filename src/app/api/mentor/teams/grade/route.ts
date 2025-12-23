import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { getRegistrationByQRCode } from '@/lib/db/registration';
import { getTeamByMemberRegistration, gradeTeam, getScoringRoundById } from '@/lib/db/team';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is a mentor or organizer
        if (session.user.role !== 'mentor' && session.user.role !== 'organizer' && session.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Only mentors and organizers can grade teams' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { eventId, qrCode, teamId, scoringRoundId, score, notes } = body;

        if (!eventId || (!qrCode && !teamId) || !scoringRoundId || score === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: eventId, qrCode OR teamId, scoringRoundId, score' },
                { status: 400 }
            );
        }

        // Verify score is a valid number
        if (typeof score !== 'number' || score < 0) {
            return NextResponse.json(
                { error: 'Score must be a non-negative number' },
                { status: 400 }
            );
        }

        // Verify the event exists
        const event = await getEventById(eventId);
        if (!event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Verify the scoring round exists
        const scoringRound = await getScoringRoundById(scoringRoundId);
        if (!scoringRound || scoringRound.eventId !== eventId) {
            return NextResponse.json(
                { error: 'Scoring round not found or does not belong to this event' },
                { status: 404 }
            );
        }

        let targetTeamId = teamId;

        if (!targetTeamId && qrCode) {
            // Get registration by QR code
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

            // Find the team that contains this user
            const team = await getTeamByMemberRegistration(registration.id);
            if (!team) {
                return NextResponse.json(
                    { error: 'User is not part of any team' },
                    { status: 400 }
                );
            }
            targetTeamId = team.id;
        }

        if (!targetTeamId) {
            return NextResponse.json(
                { error: 'Could not determine team ID' },
                { status: 400 }
            );
        }

        // Grade the team
        const teamScore = await gradeTeam(
            targetTeamId,
            scoringRoundId,
            score,
            session.user.id,
            notes
        );

        return NextResponse.json(teamScore, { status: 200 });
    } catch (error) {
        console.error('Error grading team:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to grade team' },
            { status: 500 }
        );
    }
}
