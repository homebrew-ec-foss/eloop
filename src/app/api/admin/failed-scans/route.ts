import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

/**
 * GET /api/admin/scan-logs
 * Returns all scan attempts (success and failed) with details
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

    // Only admins and organizers can view scan logs
    if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
      return NextResponse.json(
        { error: 'Admin or organizer privileges required' },
        { status: 403 }
      );
    }

    // Build query based on role
    let query = `
      SELECT 
        sl.id,
        sl.qr_code,
        sl.checkpoint,
        sl.scan_status,
        sl.error_message,
        sl.created_at,
        e.name as event_name,
        e.id as event_id,
        v.name as volunteer_name,
        v.email as volunteer_email,
        u.name as user_name,
        u.email as user_email
      FROM scan_logs sl
      LEFT JOIN events e ON sl.event_id = e.id
      LEFT JOIN users v ON sl.volunteer_id = v.id
      LEFT JOIN users u ON sl.user_id = u.id
    `;

    // Organizers only see scans from their events
    if (session.user.role === 'organizer') {
      query += ` WHERE e.organizer_id = '${session.user.id}'`;
    }

    query += ` ORDER BY sl.created_at DESC LIMIT 200`;

    // Fetch all scans (both successful and failed) with volunteer and event details
    const result = await turso.execute(query);

    const fmtExcelDT = (ts: number | string | undefined | null) => {
      if (ts === undefined || ts === null || ts === '') return '';
      const d = new Date(Number(ts));
      if (Number.isNaN(d.getTime())) return String(ts);
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        timeZone: 'Asia/Kolkata'
      };
      const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(d);
      const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
      return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
    };

    const scans = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      qr_code: row.qr_code as string | null,
      checkpoint: row.checkpoint as string | null,
      scan_status: row.scan_status as string,
      error_message: row.error_message as string | null,
      event_name: row.event_name as string | null,
      event_id: row.event_id as string | null,
      volunteer_name: row.volunteer_name as string | null,
      volunteer_email: row.volunteer_email as string | null,
      user_name: row.user_name as string | null,
      user_email: row.user_email as string | null,
      created_at: fmtExcelDT(row.created_at as number | string),
    }));

    return NextResponse.json({ scans });

  } catch (error) {
    console.error('Error fetching scan logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scan logs' },
      { status: 500 }
    );
  }
}
