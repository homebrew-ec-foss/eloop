import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';

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
        unlockedCheckpoints: event.unlockedCheckpoints
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