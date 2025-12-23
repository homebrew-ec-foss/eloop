import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TallyDashboard from '@/components/dashboard/TallyDashboard';

export const metadata: Metadata = {
    title: 'Team Tally - Dashboard',
    description: 'View final team rankings and tally'
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TallyPage({ params }: PageProps) {
    const session = await getServerSession(authConfig);

    if (!session) {
        redirect('/auth/signin');
    }

    // Only allow organizers and admins to access this page
    if (session.user.role !== 'organizer' && session.user.role !== 'admin') {
        redirect('/');
    }

    const { id: eventId } = await params;

    return (
        <div className="min-h-screen bg-slate-50">
            <TallyDashboard eventId={eventId} />
        </div>
    );
}
