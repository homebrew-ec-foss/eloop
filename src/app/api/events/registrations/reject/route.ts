import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rejectRegistration, getRegistrationById } from '@/lib/db/registration';

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
    
    // Get registration to confirm it exists and check ownership
    const existingRegistration = await getRegistrationById(registrationId);
    
    if (!existingRegistration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }
    
    // Note: organizers are authorized by role only for rejection (no per-event ownership check)
    
    // Reject the registration
    const registration = await rejectRegistration(registrationId, session.user.id);
    
    return NextResponse.json({
      success: true,
      registration
    });
    
  } catch (error) {
    console.error('Error rejecting registration:', error);
    // More detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Detailed error:', errorMessage);
    
    return NextResponse.json(
      { error: `Failed to reject registration: ${errorMessage}` },
      { status: 500 }
    );
  }
}