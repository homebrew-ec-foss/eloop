import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserEventRegistration } from '@/lib/db/registration';

// Properly type the route handler
import { NextRequest } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    // Wait for params to resolve before accessing id
    const resolvedParams = await params;
    const eventId = resolvedParams.id;

    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's registration for this event
    const registration = await getUserEventRegistration(session.user.id, eventId);

    if (!registration) {
      return NextResponse.json({
        registered: false
      });
    }

    return NextResponse.json({
      registered: true,
      status: registration.status,
      createdAt: registration.createdAt,
      approvedAt: registration.approvedAt,
      rejectedAt: registration.rejectedAt,
      checkpointCheckIns: registration.checkpointCheckIns
    });

  } catch (error) {
    console.error('Error checking registration status:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  }
}