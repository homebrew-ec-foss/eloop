import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/registrations/[id]/approve
 * Approve a registration (organizer+ only)
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

    // Update registration status to approved
    await turso.execute({
      sql: `UPDATE registrations SET status = 'approved' WHERE id = ?`,
      args: [id]
    });

    return NextResponse.json({ 
      success: true,
      message: 'Registration approved successfully' 
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    return NextResponse.json(
      { error: 'Failed to approve registration' },
      { status: 500 }
    );
  }
}
