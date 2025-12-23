import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TeamManagementClient from '@/components/TeamManagementClient';

export const metadata: Metadata = {
    title: 'Team Management',
    description: 'Form and grade teams'
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TeamManagementPage({ params }: PageProps) {
    const session = await getServerSession(authConfig);

    if (!session) {
        redirect('/auth/signin');
    }

    // Allow mentors, organizers and admins
    if (session.user.role !== 'mentor' && session.user.role !== 'organizer' && session.user.role !== 'admin') {
        redirect('/');
    }

    const { id: eventId } = await params;

    return (
        <div className="min-h-screen bg-slate-50">
            <TeamManagementClient eventId={eventId} />
        </div>
    );
}
