import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'organizer' && session.user.role !== 'admin' && session.user.role !== 'volunteer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Extract event ID from the URL pathname
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const eventId = pathParts[pathParts.indexOf('events') + 1];
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID not found in URL' }, { status: 400 });
    }
    
    // Fetch registrations with user data using JOIN
    const result = await turso.execute({
      sql: `
        SELECT 
          r.id,
          r.event_id,
          r.user_id,
          r.responses,
          r.status,
          r.qr_code,
          r.checkpoint_checkins,
          r.approved_by,
          r.approved_at,
          r.rejected_by,
          r.rejected_at,
          r.created_at,
          r.updated_at,
          u.name as user_name,
          u.email as user_email
        FROM registrations r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
        ORDER BY r.created_at DESC
      `,
      args: [eventId]
    });
    
    // Transform the results to include user object
    const registrations = result.rows.map(row => ({
      id: row.id as string,
      eventId: row.event_id as string,
      userId: row.user_id as string,
      responses: JSON.parse(row.responses as string),
      status: row.status as string,
      qrCode: row.qr_code as string,
      checkpointCheckIns: row.checkpoint_checkins ? JSON.parse(row.checkpoint_checkins as string) : [],
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at as number).toISOString() : undefined,
      rejectedBy: row.rejected_by as string | undefined,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at as number).toISOString() : undefined,
      createdAt: new Date(row.created_at as number).toISOString(),
      updatedAt: new Date(row.updated_at as number).toISOString(),
      user: {
        id: row.user_id as string,
        name: row.user_name as string || 'Unknown User',
        email: row.user_email as string || 'No email'
      }
    }));
    
    return NextResponse.json({ registrations });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}
