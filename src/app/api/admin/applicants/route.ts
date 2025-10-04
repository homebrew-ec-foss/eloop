import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getApplicants } from '@/lib/db/user';

export async function GET() {
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
        { error: 'Only admins can view applicants' },
        { status: 403 }
      );
    }
    
    // Get all unapproved users
    const applicants = await getApplicants();
    
    // Return a sanitized version without sensitive info
    const sanitizedApplicants = applicants.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    }));
    
    return NextResponse.json({ applicants: sanitizedApplicants });
    
  } catch (error) {
    console.error('Error fetching applicants:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: `Failed to fetch applicants: ${errorMessage}` },
      { status: 500 }
    );
  }
}