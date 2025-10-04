import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserRegistrations } from '@/lib/db/registration';
import { getEventById } from '@/lib/db/event';
import { turso } from '@/lib/db/client';

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
    
    const userRole = session.user.role || 'participant';
    const userId = session.user.id;
    
    // Applicants cannot view registrations yet
    if (userRole === 'applicant') {
      return NextResponse.json(
        { error: 'Applicants cannot view registrations. Please wait for your registration to be approved.' },
        { status: 403 }
      );
    }
    
    let registrationsWithEventDetails;
    
    // For organizers and admins, return ALL registrations across all events
    if (userRole === 'organizer' || userRole === 'admin') {
      const result = await turso.execute(`
        SELECT 
          r.id,
          r.event_id as eventId,
          r.user_id as userId,
          r.qr_code as qrCode,
          r.status,
          r.checkpoint_checkins as checkpointCheckIns,
          r.created_at as createdAt,
          e.name as eventName,
          e.date as eventDate,
          u.name as userName,
          u.email as userEmail
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        JOIN users u ON r.user_id = u.id
        ORDER BY e.date DESC, r.created_at DESC
      `);
      
      registrationsWithEventDetails = result.rows.map((row) => ({
        id: row.id as string,
        eventId: row.eventId as string,
        eventName: row.eventName as string,
        eventDate: row.eventDate as string,
        qrCode: row.qrCode as string,
        status: row.status as string,
        checkpointCheckIns: row.checkpointCheckIns ? JSON.parse(row.checkpointCheckIns as string) : [],
        userId: row.userId as string,
        userName: row.userName as string,
        userEmail: row.userEmail as string,
      }));
    } else {
      // For participants, return only their own registrations
      const registrations = await getUserRegistrations(userId);
      
      // For each registration, fetch the associated event details
      registrationsWithEventDetails = await Promise.all(
        registrations.map(async (registration) => {
          const event = await getEventById(registration.eventId);
          
          return {
            id: registration.id,
            eventId: registration.eventId,
            eventName: event?.name || 'Unknown Event',
            eventDate: event?.date.toISOString() || new Date().toISOString(),
            qrCode: registration.qrCode,
            status: registration.status,
            checkpointCheckIns: registration.checkpointCheckIns,
          };
        })
      );
    }
    
    // Return registrations with event details
    return NextResponse.json({ registrations: registrationsWithEventDetails });
    
  } catch (error) {
    console.error('Error fetching registrations:', error);
    // More detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    
    return NextResponse.json(
      { error: `Failed to fetch registrations: ${errorMessage}` },
      { status: 500 }
    );
  }
}