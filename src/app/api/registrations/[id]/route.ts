import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/registrations/[id]
 * Get registration details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const result = await turso.execute({
      sql: `SELECT * FROM registrations WHERE id = ?`,
      args: [id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const registration = result.rows[0];

    // Check authorization - user must be the registrant, organizer of the event, or admin
    const userRole = session.user.role;
    const userId = session.user.id;

    if (
      userRole !== 'admin' &&
      registration.user_id !== userId &&
      userRole !== 'organizer'
    ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ registration });
  } catch (error) {
    console.error('Error fetching registration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration' },
      { status: 500 }
    );
  }
}
