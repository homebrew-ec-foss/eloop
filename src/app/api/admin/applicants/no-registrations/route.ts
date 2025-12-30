import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getApplicantsWithoutRegistrations, getApplicants, getUsersByRole, getApplicantsWithoutRegistrationsForEvent } from '@/lib/db/user';
import { getEventRegistrations } from '@/lib/db/registration';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Only admin or organizer may access this
        if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const eventId = request.nextUrl.searchParams.get('eventId') || undefined;

        const applicants = eventId
            ? await getApplicantsWithoutRegistrationsForEvent(eventId)
            : await getApplicantsWithoutRegistrations();

        const byDay = applicants.reduce<Record<string, number>>((acc, u) => {
            const day = u.createdAt.toISOString().slice(0, 10);
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});

        // Metrics for conversion (if eventId provided, count users who have any registration for that event)
        let participantsCount: number;
        if (eventId) {
            const regs = await getEventRegistrations(eventId);
            const uniqueUserIds = new Set(regs.map(r => r.userId));
            participantsCount = uniqueUserIds.size;
        } else {
            const participants = await getUsersByRole('participant');
            participantsCount = participants.length;
        }

        const applicantsNoRegsCount = applicants.length;
        // conversion = participants / (participants + applicantsNoRegs)
        const conversionRate = (participantsCount + applicantsNoRegsCount) === 0 ? 0 : Math.round((participantsCount / (participantsCount + applicantsNoRegsCount)) * 1000) / 10; // one decimal

        return NextResponse.json({
            count: applicantsNoRegsCount,
            applicants: applicants.map(u => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt })),
            byDay,
            participantsCount,
            conversionRate
        });
    } catch (error) {
        console.error('Error fetching applicants without registrations:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}