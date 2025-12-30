import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { updateUserRole } from '@/lib/db/user';
import type { UserRole } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/users/[id]/promote
 * Change user role (admin only)
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

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { role, organizerId } = body;

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ['admin', 'organizer', 'volunteer', 'participant'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // If promoting to participant, ensure the user has at least one registration with a QR code
    if (role === 'participant') {
      const { getUserRegistrations } = await import('@/lib/db/registration');
      const regs = await getUserRegistrations(id);
      const hasQRCode = regs.some(r => r.qrCode && r.qrCode.trim() !== '');
      if (!hasQRCode) {
        return NextResponse.json({ error: 'Cannot promote applicant to participant: user has no registration QR code' }, { status: 400 });
      }
    }

    await updateUserRole(id, role);

    // If promoting to volunteer and organizerId provided, update that separately
    if (role === 'volunteer' && organizerId) {
      const { turso: db } = await import('@/lib/db/client');
      await db.execute({
        sql: `UPDATE users SET organizer_id = ? WHERE id = ?`,
        args: [organizerId, id]
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User role updated successfully'
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}
