import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MentorManagementClient from '@/components/admin/MentorManagementClient';

export const metadata: Metadata = {
    title: 'Mentor Management - Admin',
    description: 'Manage mentor roles'
};

export default async function MentorManagementPage() {
    const session = await getServerSession(authConfig);

    if (!session) {
        redirect('/auth/signin');
    }

    // Only allow admins and organizers
    if (session.user.role !== 'admin' && session.user.role !== 'organizer') {
        redirect('/');
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <MentorManagementClient />
        </div>
    );
}
