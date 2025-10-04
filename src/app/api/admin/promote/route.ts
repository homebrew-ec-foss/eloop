import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserByEmail, updateUserRole } from '@/lib/db/user';

// Promote a user to admin directly
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
    
    // Only admins can promote other users
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Find user by email
    const user = await getUserByEmail(email);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Update user role to admin
    const updatedUser = await updateUserRole(user.id, 'admin');
    
    return NextResponse.json({ 
      success: true, 
      message: `User ${email} promoted to admin`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Admin promotion error:', error);
    return NextResponse.json(
      { error: 'Failed to promote user to admin' },
      { status: 500 }
    );
  }
}