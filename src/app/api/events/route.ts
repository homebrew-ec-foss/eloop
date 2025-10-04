import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllEvents } from '@/lib/db/event';
import { Event } from '@/types';

export async function GET() {
  try {
    const session = await auth();
    
    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    let events: Event[] = [];
    
    // Admin, organizer, and volunteer can see all events
    if (['admin', 'organizer', 'volunteer'].includes(session.user.role)) {
      events = await getAllEvents();
    } else {
      // For participants, we'll show all upcoming events
      events = await getAllEvents();
    }
    
  // For organizers, show all events (past and future)
  return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}