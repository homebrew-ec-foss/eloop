import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/db/event';
import { turso } from '@/lib/db/client';

/**
 * GET /api/events/[id]/export/key
 * Return CSV export when a valid CSV_EXPORT_KEY is provided via header `x-export-key`
 * or query param `?key=`. No session/auth required.
 */
export async function GET(request: Request) {
  try {
    const expectedKey = process.env.CSV_EXPORT_KEY;

    if (!expectedKey) {
      console.error('CSV export key not configured (CSV_EXPORT_KEY)');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

  // Accept key via header or query param
  const headerKey = request.headers.get('x-export-key');
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key');

  const providedKey = headerKey ?? queryKey ?? null;

    if (!providedKey || providedKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract event ID from URL pathname
    const pathParts = url.pathname.split('/');
  const eventId = pathParts[pathParts.indexOf('events') + 1];
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
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

    const formFields = (event.formSchema?.fields ?? []).map((field: unknown) => {
      return (field as { label?: string }).label ?? '';
    });
    headers.push(...formFields);

    const rows = result.rows.map((row: Record<string, unknown>) => {
      const responses = row.responses ? JSON.parse(String(row.responses)) : {};
      const checkpointCheckIns = row.checkpoint_checkins ? JSON.parse(String(row.checkpoint_checkins)) : [];
      const isCheckedIn = Array.isArray(checkpointCheckIns) && checkpointCheckIns.length > 0;

      const rowData: unknown[] = [
        String(row.id ?? ''),
        String(row.user_name ?? 'N/A'),
        String(row.user_email ?? 'N/A'),
        String(row.status ?? ''),
        new Date(Number(row.created_at ?? Date.now())).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        isCheckedIn ? `Yes (${(checkpointCheckIns as unknown[]).length} checkpoint(s))` : 'No'
      ];

      (event.formSchema?.fields ?? []).forEach((field: unknown) => {
        const fieldName = (field as { name?: string }).name ?? '';
        const value = (responses as Record<string, unknown>)[fieldName];

        if (Array.isArray(value)) {
          rowData.push((value as unknown[]).join('; '));
        } else if (value === null || value === undefined) {
          rowData.push('');
        } else {
          rowData.push(String(value));
        }
      });

      return rowData;
    });

    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell).replace(/"/g, '""');
        return `"${cellStr}"`;
      }).join(','))
    ].join('\n');

    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const safeName = event.name.replace(/[^a-z0-9]/gi, '_');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${safeName}_registrations_${ts}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting registrations via key endpoint:', error);
    return NextResponse.json({ error: 'Failed to export registrations' }, { status: 500 });
  }
}
