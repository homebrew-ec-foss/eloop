import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateUserRole, assignVolunteerToOrganizer } from '@/lib/db/user';
import { hasOrganizerPrivileges } from '@/lib/db/user';

// Create volunteer account
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Only admin or organizer can create volunteers
    const canCreateVolunteer = await hasOrganizerPrivileges(session.user.id);
    if (!canCreateVolunteer) {
      return NextResponse.json(
        { error: 'Organizer privileges required' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Update user role to volunteer
    const volunteerUser = await updateUserRole(userId, 'volunteer');
    
    if (!volunteerUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Assign volunteer to this organizer
    const organizerId = session.user.role === 'admin' ? null : session.user.id;
    if (organizerId) {
      await assignVolunteerToOrganizer(userId, organizerId);
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: volunteerUser.id,
        name: volunteerUser.name,
        email: volunteerUser.email,
        role: volunteerUser.role,
        organizerId: organizerId || undefined
      }
    });
  } catch (error) {
    console.error('Create volunteer error:', error);
    return NextResponse.json(
      { error: 'Failed to create volunteer' },
      { status: 500 }
    );
  }
}