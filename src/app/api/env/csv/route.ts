import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

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

    const csvMailerLink = process.env.CSV_MAILER_LINK ?? '';
    const csvMailerPrimary = process.env.CSV_MAILER_PRIMARY ?? '';
    return NextResponse.json({ csvMailerLink, csvMailerPrimary });
  } catch (error) {
    console.error('Error in /api/env/csv:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
