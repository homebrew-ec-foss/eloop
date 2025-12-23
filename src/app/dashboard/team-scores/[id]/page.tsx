import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TeamScoresDashboard from '@/components/dashboard/TeamScoresDashboard';

export const metadata: Metadata = {
    title: 'Team Scores - Dashboard',
    description: 'View team scores and leaderboards'
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TeamScoresPage({ params }: PageProps) {
    const session = await getServerSession(authConfig);

    if (!session) {
        redirect('/auth/signin');
    }

    // Allow organizers, mentors, and admins to access this page
    if (session.user.role !== 'organizer' && session.user.role !== 'mentor' && session.user.role !== 'admin') {
        redirect('/');
    }

    const { id: eventId } = await params;

    return (
        <div className="min-h-screen bg-slate-50">
            <TeamScoresDashboard eventId={eventId} />
        </div>
    );
}
