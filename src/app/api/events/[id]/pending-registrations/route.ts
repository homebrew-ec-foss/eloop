import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { getPendingRegistrations } from '@/lib/db/registration';
import { getUserById } from '@/lib/db/user';

// Properly type the route handler
import { NextRequest } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    // User must be logged in and be an admin or organizer
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Wait for params to resolve before accessing id
    const resolvedParams = await params;
    const eventId = resolvedParams.id;
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }
    
    // Get event to check if it exists
    const event = await getEventById(eventId);
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // If user is an organizer (not admin), they can only view pending registrations for their events
    if (session.user.role === 'organizer' && event.organizerId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only view pending registrations for your own events' },
        { status: 403 }
      );
    }
    
    // Get all pending registrations for this event
    const pendingRegistrations = await getPendingRegistrations(eventId);
    
    // Fetch user details for each registration
    const registrationsWithUserInfo = await Promise.all(
      pendingRegistrations.map(async (registration) => {
        const user = await getUserById(registration.userId);
        
        return {
          ...registration,
          user: user ? {
            id: user.id,
            name: user.name,
            email: user.email
          } : null
        };
      })
    );
    
    return NextResponse.json({
      pendingRegistrations: registrationsWithUserInfo
    });
    
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending registrations' },
      { status: 500 }
    );
  }
}