import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUsersByRole } from '@/lib/db/user';

export async function GET() {
  try {
    const session = await auth();
    
    // User must be logged in and be an organizer or admin
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
      return NextResponse.json(
        { error: 'Only organizers and admins can view users' },
        { status: 403 }
      );
    }
    
    // Get all applicants, participants, and volunteers
    const applicants = await getUsersByRole('applicant');
    const participants = await getUsersByRole('participant');
    const volunteers = await getUsersByRole('volunteer');
    
    // Combine and return all users
    const users = [...applicants, ...participants, ...volunteers];
    
    return NextResponse.json({ users });
    
  } catch (error) {
    console.error('Error fetching organizer users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
