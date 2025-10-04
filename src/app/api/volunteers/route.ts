import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOrganizerVolunteers, getAllUsers } from '@/lib/db/user';

/**
 * GET /api/volunteers
 * Get volunteers (organizer sees their volunteers, admin sees all)
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
    
    if (role !== 'admin' && role !== 'organizer') {
      return NextResponse.json(
        { error: 'Unauthorized - organizer access required' },
        { status: 403 }
      );
    }

    let volunteers;
    
    if (role === 'admin') {
      const allUsers = await getAllUsers();
      volunteers = allUsers.filter(u => u.role === 'volunteer');
    } else {
      volunteers = await getOrganizerVolunteers(session.user.id);
    }
    
    return NextResponse.json({ volunteers });
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch volunteers' },
      { status: 500 }
    );
  }
}
