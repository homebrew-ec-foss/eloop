import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEventById, deleteEvent } from '@/lib/db/event';
import { getEventRegistrations } from '@/lib/db/registration';

// Properly type the route handler
import { NextRequest } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
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

    console.log(`Fetching event with ID: ${eventId}`);
    const event = await getEventById(eventId);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Return event data
    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        date: event.date.toISOString(),
        startDate: event.startDate?.toISOString(),
        endDate: event.endDate?.toISOString(),
        registrationCloseDate: event.registrationCloseDate?.toISOString(),
        location: event.location,
        imageUrl: event.imageUrl,
        organizerId: event.organizerId,
        formSchema: event.formSchema,
        checkpoints: event.checkpoints,
        unlockedCheckpoints: event.unlockedCheckpoints,
        isRegistrationOpen: event.isRegistrationOpen,
        isTeamFormationOpen: event.isTeamFormationOpen
      }
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}


export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    // User must be logged in and be an organizer
    if (!session?.user || session.user.role !== 'organizer') {
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

    // Check if event exists and belongs to the organizer
    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.organizerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if there are any registrations
    const registrations = await getEventRegistrations(eventId);
    if (registrations.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete event with existing registrations' },
        { status: 400 }
      );
    }

    const deleted = await deleteEvent(eventId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}