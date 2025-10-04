import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEventById } from '@/lib/db/event';
import { turso } from '@/lib/db/client';

/**
 * GET /api/events/[id]/export
 * Export participant registrations and form data as CSV
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user || (session.user.role !== 'organizer' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Extract event ID from the URL pathname
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const eventId = pathParts[pathParts.indexOf('events') + 1];
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID not found in URL' }, { status: 400 });
    }
    
    // Get event details
    const event = await getEventById(eventId);
    
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    // For organizers, verify they own this event
    if (session.user.role === 'organizer' && event.organizerId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Fetch registrations with user data
    const result = await turso.execute({
      sql: `
        SELECT 
          r.id,
          r.responses,
          r.status,
          r.created_at,
          r.checkpoint_checkins,
          u.name as user_name,
          u.email as user_email
        FROM registrations r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
        ORDER BY r.created_at ASC
      `,
      args: [eventId]
    });
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No registrations found for this event' }, { status: 404 });
    }
    
    // Build CSV headers
    const headers = [
      'Registration ID',
      'Name',
      'Email',
      'Status',
      'Registration Date',
      'Check-in Status'
    ];
    
    // Add form field headers
    const formFields = event.formSchema.fields.map(field => field.label);
    headers.push(...formFields);
    
    // Build CSV rows
    const rows = result.rows.map(row => {
      const responses = JSON.parse(row.responses as string);
      const checkpointCheckIns = row.checkpoint_checkins ? JSON.parse(row.checkpoint_checkins as string) : [];
      const isCheckedIn = checkpointCheckIns.length > 0;
      
      const rowData = [
        row.id as string,
        row.user_name as string || 'N/A',
        row.user_email as string || 'N/A',
        row.status as string,
        new Date(row.created_at as number).toLocaleString(),
        isCheckedIn ? `Yes (${checkpointCheckIns.length} checkpoint(s))` : 'No'
      ];
      
      // Add form field values
      event.formSchema.fields.forEach(field => {
        const value = responses[field.name];
        
        // Handle different field types
        if (Array.isArray(value)) {
          rowData.push(value.join('; '));
        } else if (value === null || value === undefined) {
          rowData.push('');
        } else {
          rowData.push(String(value));
        }
      });
      
      return rowData;
    });
    
    // Generate CSV content
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes
        const cellStr = String(cell).replace(/"/g, '""');
        return `"${cellStr}"`;
      }).join(','))
    ].join('\n');
    
    // Return CSV file
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${event.name.replace(/[^a-z0-9]/gi, '_')}_registrations_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    
  } catch (error) {
    console.error('Error exporting registrations:', error);
    return NextResponse.json(
      { error: 'Failed to export registrations' },
      { status: 500 }
    );
  }
}
