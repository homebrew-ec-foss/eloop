import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserRegistrations } from '@/lib/db/registration';

/**
 * GET /api/registrations
 * Get current user's registrations
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

    const registrations = await getUserRegistrations(session.user.id);
    
    return NextResponse.json({ registrations });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registrations
 * Register current user for an event
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { eventId, formData } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Forward to the existing register endpoint logic
    const registerResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/events/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId,
        userId: session.user.id,
        formData
      })
    });

    const data = await registerResponse.json();
    return NextResponse.json(data, { status: registerResponse.status });
  } catch (error) {
    console.error('Error creating registration:', error);
    return NextResponse.json(
      { error: 'Failed to create registration' },
      { status: 500 }
    );
  }
}
