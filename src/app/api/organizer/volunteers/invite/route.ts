import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assignVolunteerToOrganizer, getUserById } from '@/lib/db/user';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'organizer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { userId } = await req.json();
    // Check if user exists
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }
    // Assign as volunteer to this organizer
    await assignVolunteerToOrganizer(userId, session.user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to invite volunteer' }, { status: 500 });
  }
}
