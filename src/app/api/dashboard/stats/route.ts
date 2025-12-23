import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllEvents, getOrganizerEvents } from '@/lib/db/event';
import { getOrganizerVolunteers, getAllUsers } from '@/lib/db/user';
import { getEventRegistrations, getUserRegistrations } from '@/lib/db/registration';
import { turso } from '@/lib/db/client';

/**
 * GET /api/dashboard/stats
 * Returns role-aware dashboard statistics
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

    const role = session.user.role;
    const userId = session.user.id;

    // Admin dashboard stats
    if (role === 'admin') {
      const events = await getAllEvents();
      const users = await getAllUsers();

      let totalRegistrations = 0;
      let pendingApprovals = 0;

      for (const event of events) {
        const regs = await getEventRegistrations(event.id);
        totalRegistrations += regs.length;
        pendingApprovals += regs.filter(r => r.status === 'pending').length;
      }

      const applicants = users.filter(u => u.role === 'applicant');
      const organizers = users.filter(u => u.role === 'organizer');
      const volunteers = users.filter(u => u.role === 'volunteer');
      const participants = users.filter(u => u.role === 'participant');

      // Count failed scans
      let failedScans = 0;
      try {
        const failedScansResult = await turso.execute({
          sql: `SELECT COUNT(*) as count FROM scan_logs WHERE scan_status != 'success'`
        });
        failedScans = Number(failedScansResult.rows[0]?.count || 0);
      } catch {
        console.log('scan_logs table not found, defaulting to 0');
      } return NextResponse.json({
        role: 'admin',
        events: events.length,
        users: users.length,
        applicants: applicants.length,
        organizers: organizers.length,
        volunteers: volunteers.length,
        participants: participants.length,
        totalRegistrations,
        pendingApprovals,
        failedScans
      });
    }

    // Organizer dashboard stats
    if (role === 'organizer') {
      const events = await getOrganizerEvents(userId);
      const volunteers = await getOrganizerVolunteers(userId);

      let pendingRegistrations = 0;
      let approvedRegistrations = 0;

      for (const event of events) {
        const regs = await getEventRegistrations(event.id);
        pendingRegistrations += regs.filter(r => r.status === 'pending').length;
        approvedRegistrations += regs.filter(r => r.status === 'approved').length;
      }

      // Count failed scans for organizer's events
      const eventIds = events.map(e => e.id);
      let failedScans = 0;

      if (eventIds.length > 0) {
        try {
          const placeholders = eventIds.map(() => '?').join(',');
          const failedScansResult = await turso.execute({
            sql: `SELECT COUNT(*) as count FROM scan_logs WHERE event_id IN (${placeholders}) AND scan_status != 'success'`,
            args: eventIds
          });
          failedScans = Number(failedScansResult.rows[0]?.count || 0);
        } catch {
          console.log('scan_logs table not found, defaulting to 0');
        }
      }

      return NextResponse.json({
        role: 'organizer',
        events: events.length,
        volunteers: volunteers.length,
        pendingRegistrations,
        approvedRegistrations,
        failedScans
      });
    }

    // Volunteer dashboard stats
    if (role === 'volunteer') {
      const events = await getAllEvents();

      // Get all checked-in registrations and count those checked in by this volunteer
      const checkInsResult = await turso.execute({
        sql: `SELECT checkpoint_checkins FROM registrations WHERE status = 'checked-in'`
      });

      let checkIns = 0;
      for (const row of checkInsResult.rows) {
        const checkpoints = JSON.parse(row.checkpoint_checkins as string || '[]');
        // Count if this volunteer checked in at any checkpoint
        if (checkpoints.some((cp: { checkedInBy: string }) => cp.checkedInBy === userId)) {
          checkIns++;
        }
      }

      return NextResponse.json({
        role: 'volunteer',
        events: events.length,
        checkIns,
        pending: 0
      });
    }

    // Participant dashboard stats
    if (role === 'participant') {
      const registrations = await getUserRegistrations(userId);
      const events = await getAllEvents();

      const approved = registrations.filter(r => r.status === 'approved').length;
      const pending = registrations.filter(r => r.status === 'pending').length;

      return NextResponse.json({
        role,
        availableEvents: events.length,
        registrations: registrations.length,
        approved,
        pending
      });
    }

    // Applicant stats (pending approval)
    if (role === 'applicant') {
      return NextResponse.json({
        role: 'applicant',
        message: 'Your account is pending approval'
      });
    }
    if (role === 'mentor') {
      return NextResponse.json({
        role: 'mentor',
        message: 'Welcome, Mentor! Access team management from the event details page.'
      });
    }

    return NextResponse.json(
      { error: 'Invalid role' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
