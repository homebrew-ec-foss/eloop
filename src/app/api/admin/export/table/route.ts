import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

// Admin-only generic table -> CSV exporter. Usage: /api/admin/export/table?table=users
// Optional event_id param is supported for tables that have event_id.
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
  const table = url.searchParams.get('table');
  const eventId = url.searchParams.get('event_id');
  const status = url.searchParams.get('status');

    // whitelist of tables we allow exporting
    const allowed: Record<string, {select: string, whereEvent?: boolean}> = {
      users: { select: 'id, email, name, role, organizer_id, created_at, updated_at' },
      events: { select: 'id, name, description, date, start_date, end_date, registration_close_date, location, organizer_id, checkpoints, is_registration_open, created_at, updated_at' },
      registrations: { select: 'id, event_id, user_id, responses, status, qr_code, checkpoint_checkins, checked_in_by, checked_in_at, approved_by, approved_at, rejected_by, rejected_at, created_at, updated_at', whereEvent: true },
      scan_logs: { select: 'id, event_id, volunteer_id, qr_code, checkpoint, scan_status, error_message, user_id, registration_id, created_at', whereEvent: true }
    };

    if (!table || !(table in allowed)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 });

    const meta = allowed[table];
    let sql = `SELECT ${meta.select} FROM ${table}`;
    const args: (string | number)[] = [];

    // Special handling for scan_logs: join with users to resolve names
    if (table === 'scan_logs') {
      sql = `
        SELECT
          s.id,
          s.event_id,
          s.checkpoint,
          s.scan_status,
          s.error_message,
          s.qr_code,
          s.created_at,
          u_part.name as participant_name,
          u_vol.name as volunteer_name
        FROM scan_logs s
        LEFT JOIN users u_part ON s.user_id = u_part.id
        LEFT JOIN users u_vol ON s.volunteer_id = u_vol.id
      `;
      if (eventId) {
        sql += ' WHERE s.event_id = ?';
        args.push(eventId);
      }
      sql += ' ORDER BY s.created_at ASC';
    } else if (table === 'registrations') {
      // Special handling for registrations: join with users to resolve names
      sql = `
        SELECT
          r.id,
          r.event_id,
          r.responses,
          r.status,
          r.qr_code,
          r.checkpoint_checkins,
          r.checked_in_at,
          r.approved_at,
          r.rejected_at,
          r.created_at,
          r.updated_at,
          u_user.name as user_name,
          u_checked.name as checked_in_by_name,
          u_approved.name as approved_by_name,
          u_rejected.name as rejected_by_name
        FROM registrations r
        LEFT JOIN users u_user ON r.user_id = u_user.id
        LEFT JOIN users u_checked ON r.checked_in_by = u_checked.id
        LEFT JOIN users u_approved ON r.approved_by = u_approved.id
        LEFT JOIN users u_rejected ON r.rejected_by = u_rejected.id
      `;
      const where: string[] = [];
      if (eventId) {
        where.push('r.event_id = ?');
        args.push(eventId);
      }
      if (status) {
        where.push('r.status = ?');
        args.push(status);
      }
      if (where.length > 0) {
        sql += ' WHERE ' + where.join(' AND ');
      }
      sql += ' ORDER BY r.created_at ASC';
    } else {
      if (meta.whereEvent && eventId) {
        sql += ' WHERE event_id = ?';
        args.push(eventId);
      }
      sql += ' ORDER BY created_at ASC';
    }

    const result = await turso.execute(sql, args.length ? args : undefined);
    if (result.rows.length === 0) return NextResponse.json({ error: 'No rows' }, { status: 404 });
    
    // For scan_logs, get event checkpoint order for prefixing
    let checkpointOrder: string[] = [];
    if (table === 'scan_logs' && eventId) {
      const eventResult = await turso.execute({
        sql: 'SELECT checkpoints FROM events WHERE id = ?',
        args: [eventId]
      });
      if (eventResult.rows.length > 0) {
        try {
          const cp = eventResult.rows[0].checkpoints;
          if (typeof cp === 'string') {
            checkpointOrder = JSON.parse(cp as string);
          } else if (Array.isArray(cp)) {
            checkpointOrder = cp as string[];
          }
        } catch (e) {
          checkpointOrder = [];
        }
      }
    }

    // Build CSV header from column names
    let cols: string[];
    if (table === 'scan_logs') {
      // Use custom headers for scan_logs with resolved names
      cols = ['id', 'event_id', 'checkpoint', 'participant_name', 'volunteer_name', 'scan_status', 'error_message', 'qr_code', 'created_at'];
    } else if (table === 'registrations') {
      // Use custom headers for registrations with resolved names
      cols = ['id', 'event_id', 'user_name', 'responses', 'status', 'qr_code', 'checkpoint_checkins', 'checked_in_by_name', 'checked_in_at', 'approved_by_name', 'approved_at', 'rejected_by_name', 'rejected_at', 'created_at', 'updated_at'];
    } else {
      cols = meta.select.split(',').map(c => c.trim());
    }
    
    const escapeCell = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`;

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
    const csvLines = [cols.map(h => escapeCell(h)).join(',')];

    // Prepare set of timestamp-like columns once
    const tsCols = new Set([
      'created_at','updated_at','date','start_date','end_date','registration_close_date',
      'checked_in_at','approved_at','rejected_at'
    ]);

    // Build checkpoint order map for scan_logs
    const orderMap = new Map<string, number>();
    if (table === 'scan_logs') {
      checkpointOrder.forEach((c, i) => orderMap.set(c, i));
    }

    // Build rows with checkpoint prefixing for scan_logs
    const pad = (n: number) => String(n).padStart(2, '0');
    const builtRows = result.rows.map((row) => {
      const cells = cols.map(col => {
        let val: unknown = (row as Record<string, unknown>)[col];

        // Special handling for scan_logs checkpoint: prefix with zero-padded order
        if (table === 'scan_logs' && col === 'checkpoint' && typeof val === 'string') {
          const checkpoint = String(val);
          const orderIndex = orderMap.has(checkpoint) ? (orderMap.get(checkpoint) as number) : 99;
          val = `${pad(orderIndex)}-${checkpoint}`;
        }

        // If value is already an array or object, render it nicely
        if (Array.isArray(val)) {
          val = (val as unknown[]).join('; ');
        } else if (val && typeof val === 'object') {
          val = Object.entries(val as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join('; ');
        } else if (typeof val === 'string') {
          // Trim and try to parse JSON-like strings. Also strip surrounding quotes if present
          let s = (val as string).trim();
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1).trim();
          }
          if ((s.startsWith('[') || s.startsWith('{')) && (s.endsWith(']') || s.endsWith('}'))) {
            try {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) {
                val = parsed.join('; ');
              } else if (parsed && typeof parsed === 'object') {
                val = Object.entries(parsed).map(([k, v]) => `${k}: ${String(v)}`).join('; ');
              } else {
                val = String(parsed);
              }
            } catch (_e) {
              // leave original string if parsing fails
              val = s;
            }
          }
        }

        // Sanitize inner newlines and commas in rendered values (arrays/objects) so CSV cells are single-line and don't contain commas
        if (typeof val === 'string') {
          val = (val as string).replace(/\r?\n/g, ' ').replace(/,/g, ';');
        }

        // Format known timestamp columns to Excel-friendly local string so Excel can sort
        if (val !== null && val !== undefined && tsCols.has(col)) {
          return escapeCell(fmtExcelDT(String(val)));
        }

        return escapeCell(val ?? '');
      });

      return cells;
    });

    // Sort scan_logs by checkpoint order then created_at
    if (table === 'scan_logs') {
      builtRows.sort((a, b) => {
        // Extract checkpoint prefix order from first cell
        const aCheckpoint = String(a[2]).replace(/^"\d{2}-/, '').replace(/"$/, '');
        const bCheckpoint = String(b[2]).replace(/^"\d{2}-/, '').replace(/"$/, '');
        const aOrder = orderMap.has(aCheckpoint) ? (orderMap.get(aCheckpoint) as number) : 99;
        const bOrder = orderMap.has(bCheckpoint) ? (orderMap.get(bCheckpoint) as number) : 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // If same checkpoint, sort by created_at (last column)
        return 0; // already sorted by created_at in query
      });
    }

    // Build CSV lines
    builtRows.forEach(cells => {
      csvLines.push(cells.join(','));
    });

    const csv = csvLines.join('\n');
    const now = new Date();
    const ts = now.toISOString().replace(/[:]/g, '-').replace(/T/, '_').split('.')[0];
    return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${table}_${ts}.csv"` } });
  } catch (err) {
    console.error('Error exporting table CSV:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
