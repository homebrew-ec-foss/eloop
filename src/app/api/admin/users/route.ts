import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllUsers, updateUserRole } from '@/lib/db/user';
import { UserRole } from '@/types';

// Get all users (admin only)
export async function GET() {
  try {
    const session = await auth();

    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // User must be admin or organizer
    if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
      return NextResponse.json(
        { error: 'Admin or organizer access required' },
        { status: 403 }
      );
    }
    // Get all users
    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Update user role (admin only)
export async function PUT(request: Request) {
  try {
    const session = await auth();

    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // User must be admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: UserRole[] = ['admin', 'organizer', 'volunteer', 'participant'];
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Don't allow admins to demote themselves
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Update user role
    const updatedUser = await updateUserRole(userId, role as UserRole);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}

// Delete a user (admin only)
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent admins from deleting themselves
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own user account' }, { status: 400 });
    }

    const { deleteUser } = await import('@/lib/db/user');
    try {
      const deleted = await deleteUser(userId);

      if (!deleted) {
        return NextResponse.json({ error: 'User not found or could not be deleted' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (e) {
      console.error('Error in deleteUser:', e instanceof Error ? e.message : e);
      const message = e instanceof Error ? e.message : 'Failed to delete user';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}