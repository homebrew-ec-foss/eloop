import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserRegistrations } from '@/lib/db/registration';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;
    // Get the first approved registration
    const registrations = await getUserRegistrations(userId);
    const approved = registrations.find((reg) => reg.status === 'approved');
    if (!approved) {
      return NextResponse.json({ error: 'No approved registration found' }, { status: 404 });
    }
  // Return the stored QR code string (JWT)
  return NextResponse.json({ qrCode: approved.qrCode });
  } catch {
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
