import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserById, approveApplicant } from '@/lib/db/user';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // User must be logged in and be an admin
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can approve applicants' },
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
    
    // Get user to confirm they exist and are an applicant
    const existingUser = await getUserById(userId);
    
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (existingUser.role !== 'applicant') {
      return NextResponse.json(
        { error: 'User is not an applicant' },
        { status: 400 }
      );
    }
    
    // Approve the applicant (promote to participant)
    const updatedUser = await approveApplicant(userId);
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
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
    console.error('Error approving applicant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: `Failed to approve applicant: ${errorMessage}` },
      { status: 500 }
    );
  }
}