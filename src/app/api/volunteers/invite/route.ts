import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserByEmail, createUser } from '@/lib/db/user';

/**
 * POST /api/volunteers/invite
 * Invite a volunteer (organizer+ only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = session.user.role;
    if (role !== 'admin' && role !== 'organizer') {
      return NextResponse.json(
        { error: 'Unauthorized - organizer access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Create new volunteer user
    const organizerId = role === 'organizer' ? session.user.id : undefined;
    const newUser = await createUser({
      id: crypto.randomUUID(),
      email,
      name,
      role: 'volunteer',
      organizerId
    });
    
    return NextResponse.json({ 
      success: true,
      message: 'Volunteer invited successfully',
      user: newUser 
    });
  } catch (error) {
    console.error('Error inviting volunteer:', error);
    return NextResponse.json(
      { error: 'Failed to invite volunteer' },
      { status: 500 }
    );
  }
}
