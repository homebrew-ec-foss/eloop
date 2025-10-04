import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/registrations/[id]/reject
 * Reject a registration (organizer+ only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userRole = session.user.role;
    if (userRole !== 'admin' && userRole !== 'organizer') {
      return NextResponse.json(
        { error: 'Unauthorized - organizer access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Update registration status to rejected
    await turso.execute({
      sql: `UPDATE registrations SET status = 'rejected' WHERE id = ?`,
      args: [id]
    });

    return NextResponse.json({ 
      success: true,
      message: 'Registration rejected successfully' 
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    return NextResponse.json(
      { error: 'Failed to reject registration' },
      { status: 500 }
    );
  }
}
