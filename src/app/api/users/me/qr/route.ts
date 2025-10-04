import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateParticipantQR } from '@/lib/qr';
import { getUserRegistrations } from '@/lib/db/registration';

/**
 * GET /api/users/me/qr
 * Get current user's QR code for their approved event registration
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

    // Check if user is a participant (not an applicant)
    if (session.user.role === 'applicant') {
      return NextResponse.json(
        { error: 'Account pending approval' },
        { status: 403 }
      );
    }

    // Get user's approved registrations
    const registrations = await getUserRegistrations(session.user.id);
    const approvedReg = registrations.find(r => r.status === 'approved');

    if (!approvedReg) {
      return NextResponse.json(
        { error: 'No approved registration found' },
        { status: 404 }
      );
    }

    const qrCode = await generateParticipantQR(session.user.id, approvedReg.eventId);
    
    return NextResponse.json({ 
      qrCode,
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      eventId: approvedReg.eventId
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
