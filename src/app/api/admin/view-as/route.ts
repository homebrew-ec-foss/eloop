import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserById } from '@/lib/db/user';
import { getUserRegistrations } from '@/lib/db/registration';
import { getEventById } from '@/lib/db/event';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const registrations = await getUserRegistrations(userId);
    const activeReg = registrations.find(r => r.status === 'approved' || r.status === 'checked-in')
      || registrations.find(r => r.status === 'pending');

    if (!activeReg) {
      return NextResponse.json({ hasRegistration: false, message: 'No active registration found', user });
    }

    const event = await getEventById(activeReg.eventId);

    return NextResponse.json({
      hasRegistration: true,
      registration: {
        id: activeReg.id,
        eventId: activeReg.eventId,
        eventName: event?.name || 'Unknown Event',
        eventDate: event?.date || new Date(),
        status: activeReg.status,
        qrCode: activeReg.qrCode,
        checkpointCheckIns: activeReg.checkpointCheckIns || [],
        createdAt: activeReg.createdAt ? activeReg.createdAt.toISOString() : null,
        approvedAt: activeReg.approvedAt ? activeReg.approvedAt.toISOString() : null
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error in admin view-as:', error);
    return NextResponse.json({ error: 'Failed to fetch view-as data' }, { status: 500 });
  }
}
