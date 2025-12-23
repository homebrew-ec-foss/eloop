import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { getUserById, updateUserRole, getAllUsers, getUsersByRole } from '@/lib/db/user';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only organizers and admins can promote users to mentor
        if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
            return NextResponse.json(
                { error: 'Only organizers and admins can promote users to mentor' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { userId, action } = body; // action: 'promote' or 'demote'

        if (!userId || !action) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, action' },
                { status: 400 }
            );
        }

        const user = await getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const newRole = action === 'promote' ? 'mentor' : 'participant';

        const updatedUser = await updateUserRole(userId, newRole);

        return NextResponse.json(updatedUser, { status: 200 });
    } catch (error) {
        console.error('Error promoting user to mentor:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to promote user' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only organizers and admins can view mentor management
        if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
            return NextResponse.json(
                { error: 'Only organizers and admins can view mentor management' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role'); // Filter by role (e.g., 'mentor', 'participant', 'organizer')

        let users;
        if (role) {
            users = await getUsersByRole(role as any);
        } else {
            users = await getAllUsers();
        }

        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch users' },
            { status: 500 }
        );
    }
}
