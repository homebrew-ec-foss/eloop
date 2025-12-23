import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MentorManagementClient from '@/components/admin/MentorManagementClient';

export default async function MentorManagementPage() {
    const session = await getServerSession(authConfig);

    if (!session?.user) {
        redirect('/auth/signin');
    }

    // Only allow organizers and admins
    if (session.user.role !== 'organizer' && session.user.role !== 'admin') {
        redirect('/dashboard');
    }

    return <MentorManagementClient />;
}
