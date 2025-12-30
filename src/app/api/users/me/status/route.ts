import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserRegistrations } from '@/lib/db/registration';
import { getEventById } from '@/lib/db/event';

/**
 * GET /api/users/me/status
 * Get current user's registration status with checkpoint check-ins
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's registrations
    const registrations = await getUserRegistrations(session.user.id);

    // Find the most recent registration (prioritize approved/checked-in, then pending, then show rejected)
    const activeReg = registrations.find(r => r.status === 'approved' || r.status === 'checked-in')
      || registrations.find(r => r.status === 'pending')
      || registrations.find(r => r.status === 'rejected');

    if (!activeReg) {
      return NextResponse.json({
        hasRegistration: false,
        message: 'No active registration found'
      });
    }

    // Get event details
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
        id: session.user.id,
        name: session.user.name,
        email: session.user.email
      }
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user status' },
      { status: 500 }
    );
  }
}
