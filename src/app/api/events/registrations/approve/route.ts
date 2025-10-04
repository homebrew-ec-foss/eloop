import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { approveRegistration, getRegistrationById } from '@/lib/db/registration';
import { getUserById, approveApplicant } from '@/lib/db/user';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // User must be logged in and be an admin or organizer
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { registrationId } = body;
    
    if (!registrationId) {
      return NextResponse.json(
        { error: 'Registration ID is required' },
        { status: 400 }
      );
    }
    
    // Get registration to confirm it exists
    const existingRegistration = await getRegistrationById(registrationId);
    
    if (!existingRegistration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }
    
    // Approve the registration
    const registration = await approveRegistration(registrationId, session.user.id);
    
    // If the user is an applicant, promote them to participant
    const user = await getUserById(existingRegistration.userId);
    if (user && user.role === 'applicant') {
      await approveApplicant(user.id);
      console.log(`Promoted applicant ${user.id} to participant`);
    }
    
    return NextResponse.json({
      success: true,
      registration
    });
    
  } catch (error) {
    console.error('Error approving registration:', error);
    // More detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    
    return NextResponse.json(
      { error: `Failed to approve registration: ${errorMessage}` },
      { status: 500 }
    );
  }
}