import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

/**
 * GET /api/admin/export/checkpoint
 * Admin-only checkpoint scan logs CSV exporter.
 * Returns scan logs with resolved user names, checkpoint prefixed with zero-padded order.
 * Usage: /api/admin/export/checkpoint?event_id=<id>
 * Supports key auth via header x-export-key or ?key=...
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // Key-based auth: header x-export-key or ?key=...
    const expectedKey = process.env.CSV_EXPORT_KEY;
    const headerKey = req.headers.get('x-export-key');
    const queryKey = url.searchParams.get('key');
    const providedKey = headerKey ?? queryKey ?? null;

    if (providedKey) {
      if (!expectedKey || providedKey !== expectedKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // key matched: allow access
    } else {
      // fallback to session auth
      const session = await auth();
      if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'organizer')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const eventId = url.searchParams.get('event_id');
    if (!eventId) {
      return NextResponse.json({ error: 'event_id required' }, { status: 400 });
    }

    // Get event details to retrieve checkpoint order
    const eventResult = await turso.execute({
      sql: 'SELECT id, name, checkpoints FROM events WHERE id = ?',
      args: [eventId]
    });

    if (eventResult.rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventRow = eventResult.rows[0];
    const eventName = String(eventRow.name ?? 'event');
    let checkpointOrder: string[] = [];
    try {
      const cp = eventRow.checkpoints;
      if (typeof cp === 'string') {
        checkpointOrder = JSON.parse(cp as string);
      } else if (Array.isArray(cp)) {
        checkpointOrder = cp as string[];
      }
    } catch (e) {
      checkpointOrder = [];
    }

    // Build order map for checkpoint prefixing
    const orderMap = new Map<string, number>();
    checkpointOrder.forEach((c, i) => orderMap.set(c, i));

    // Query: join scan_logs with users for volunteer and participant
    const result = await turso.execute({
      sql: `
        SELECT
          s.id,
          s.checkpoint,
          s.scan_status,
          s.error_message,
          s.created_at,
          u_part.name as participant_name,
          u_vol.name as volunteer_name
        FROM scan_logs s
        LEFT JOIN users u_part ON s.user_id = u_part.id
        LEFT JOIN users u_vol ON s.volunteer_id = u_vol.id
        WHERE s.event_id = ?
        ORDER BY s.created_at ASC
      `,
      args: [eventId]
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No scan logs found' }, { status: 404 });
    }

    // Excel-friendly formatter for timestamps
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

    // CSV headers (consistent per export)
    const headers = ['checkpoint', 'participant_name', 'volunteer_name', 'scan_time', 'scan_status', 'error_message'];

    // Build rows with checkpoint ordering
    const pad = (n: number) => String(n).padStart(2, '0');

    type BuiltRow = {
      checkpoint: string;
      participant: string;
      volunteer: string;
      scanTime: string;
      status: string;
      error: string;
      createdAt: number;
      orderIndex: number;
    };

    const built: BuiltRow[] = result.rows.map((r: Record<string, unknown>) => {
      const checkpoint = String(r.checkpoint ?? '');
      const participant = String(r.participant_name ?? '');
      const volunteer = String(r.volunteer_name ?? '');
      const createdAt = Number(r.created_at ?? Date.now());
      const scanTime = fmtExcelDT(createdAt);
      const status = String(r.scan_status ?? '');
      let error = String(r.error_message ?? '');

      // Sanitize error message (replace newlines and commas)
      error = error.replace(/\r?\n/g, ' ').replace(/,/g, ';');

      const orderIndex = orderMap.has(checkpoint) ? (orderMap.get(checkpoint) as number) : Number.MAX_SAFE_INTEGER;
      return { checkpoint, participant, volunteer, scanTime, status, error, createdAt, orderIndex };
    });

    // Sort by checkpoint order, then by created_at
    built.sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a.createdAt - b.createdAt;
    });

    // Prefix checkpoint with zero-padded index
    const rows = built.map(r => {
      const idx = r.orderIndex === Number.MAX_SAFE_INTEGER ? 99 : r.orderIndex;
      const pref = `${pad(idx)}-${r.checkpoint}`;
      return [pref, r.participant, r.volunteer, r.scanTime, r.status, r.error];
    });

    const escapeCell = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(h => escapeCell(h)).join(','), ...rows.map(r => r.map(c => escapeCell(c)).join(','))].join('\n');

    const now = new Date();
    const ts = now.toISOString().replace(/[:]/g, '-').replace(/T/, '_').split('.')[0];
    const safeName = eventName.replace(/[^a-z0-9]/gi, '_');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${safeName}_checkpoint_scans_${ts}.csv"`
      }
    });
  } catch (err) {
    console.error('Error exporting checkpoint CSV:', err);
    return NextResponse.json({ error: 'Failed to export checkpoint logs' }, { status: 500 });
  }
}
