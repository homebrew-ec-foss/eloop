import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rejectRegistration, getRegistrationById } from '@/lib/db/registration';

export async function POST(request: NextRequest) {
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
    
    // Parse request body
    const body = await request.json();
    const { registrationId } = body;
    
    if (!registrationId) {
      return NextResponse.json(
        { error: 'Registration ID is required' },
        { status: 400 }
      );
    }
    
    // Get registration to confirm it exists and check ownership
    const existingRegistration = await getRegistrationById(registrationId);
    
    if (!existingRegistration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }
    
    // If user is an organizer (not admin), they can only reject registrations for their events
    if (session.user.role === 'organizer') {
      try {
        // Import the getEventById function
        const { getEventById } = await import('@/lib/db/event');
        
        // Get the event associated with this registration
        const event = await getEventById(existingRegistration.eventId);
        
        console.log('Event ownership check (reject):', { 
          eventId: existingRegistration.eventId,
          eventExists: !!event,
          eventOrganizerId: event?.organizerId,
          userId: session.user.id,
          ownershipMatch: event?.organizerId === session.user.id
        });
        
        // Check if the event exists and belongs to this organizer
        if (!event || event.organizerId !== session.user.id) {
          return NextResponse.json(
            { error: 'You can only reject registrations for your own events' },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error('Error during ownership check for rejection:', error);
        return NextResponse.json(
          { error: 'Error verifying event ownership for rejection' },
          { status: 500 }
        );
      }
    }
    
    // Reject the registration
    const registration = await rejectRegistration(registrationId, session.user.id);
    
    return NextResponse.json({
      success: true,
      registration
    });
    
  } catch (error) {
    console.error('Error rejecting registration:', error);
    // More detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    
    return NextResponse.json(
      { error: `Failed to reject registration: ${errorMessage}` },
      { status: 500 }
    );
  }
}