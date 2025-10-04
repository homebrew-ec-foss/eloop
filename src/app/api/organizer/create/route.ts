import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateUserRole } from '@/lib/db/user';
import { isUserAdmin } from '@/lib/db/user';

// Create organizer account
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
    
    // Only admin can create organizers
    const isAdmin = await isUserAdmin(session.user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
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
    
    // Update user role to organizer
    const updatedUser = await updateUserRole(userId, 'organizer');
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Create organizer error:', error);
    return NextResponse.json(
      { error: 'Failed to create organizer' },
      { status: 500 }
    );
  }
}