import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

/**
 * GET /api/admin/export/tally
 * Admin/Organizer-only tally CSV exporter.
 * Returns final team rankings with scores per round.
 * Usage: /api/admin/export/tally?event_id=<id>
 * Supports key auth via header x-export-key or ?key=...
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        // Key-based auth: header x-export-key or ?key=...
        const expectedKey = process.env.CSV_EXPORT_KEY;
        const headerKey = req.headers.get('x-export-key');
        const queryKey = url.searchParams.get('key');
        const providedKey = headerKey ?? queryKey ?? null;

        if (providedKey) {
            if (!expectedKey || providedKey !== expectedKey) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            // key matched: allow access
        } else {
            // fallback to session auth
            const session = await auth();
            if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'organizer')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const eventId = url.searchParams.get('event_id');
        if (!eventId) {
            return NextResponse.json({ error: 'event_id required' }, { status: 400 });
        }

        // Get event details
        const eventResult = await turso.execute({
            sql: 'SELECT id, name FROM events WHERE id = ?',
            args: [eventId]
        });

        if (eventResult.rows.length === 0) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const eventName = String(eventResult.rows[0].name ?? 'event');

        // Get scoring rounds
        const roundsResult = await turso.execute({
            sql: 'SELECT id, name FROM scoring_rounds WHERE event_id = ? ORDER BY created_at ASC',
            args: [eventId]
        });

        const rounds = roundsResult.rows.map((row) => ({
            id: String(row.id),
            name: String(row.name ?? 'Round')
        }));

        // Get teams with their scores
        const teamsResult = await turso.execute({
            sql: 'SELECT id, name, member_ids FROM teams WHERE event_id = ?',
            args: [eventId]
        });

        const leaderboardData = [];

        for (const teamRow of teamsResult.rows) {
            const teamId = String(teamRow.id);
            const teamName = String(teamRow.name ?? 'Team');
            const memberIds = JSON.parse(String(teamRow.member_ids ?? '[]'));

            // Get scores for each round
            const scoresResult = await turso.execute({
                sql: 'SELECT scoring_round_id, score FROM team_scores WHERE team_id = ?',
                args: [teamId]
            });

            const scoresByRoundId: Record<string, number> = {};
            let totalScore = 0;

            for (const scoreRow of scoresResult.rows) {
                const roundId = String(scoreRow.scoring_round_id);
                const score = Number(scoreRow.score ?? 0);
                scoresByRoundId[roundId] = score;
                totalScore += score;
            }

            leaderboardData.push({
                teamName,
                memberCount: memberIds.length,
                scoresByRoundId,
                totalScore
            });
        }

        // Sort by total score descending
        leaderboardData.sort((a, b) => b.totalScore - a.totalScore);

        // Build CSV
        const headers = ['Rank', 'Team Name', 'Members', ...rounds.map(r => r.name), 'Total Score'];
        const rows = leaderboardData.map((entry, idx) => {
            const rank = idx + 1;
            const roundScores = rounds.map(r => {
                const score = entry.scoresByRoundId[r.id];
                return score !== undefined ? score.toFixed(2) : '—';
            });
            return [rank, entry.teamName, entry.memberCount, ...roundScores, entry.totalScore.toFixed(2)];
        });

        const csvLines = [
            headers.join(','),
            ...rows.map(row => row.map(cell => {
                const str = String(cell);
                // Escape commas and quotes
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(','))
        ];

        const csv = csvLines.join('\n');
        const filename = `tally_${eventName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error) {
        console.error('Error exporting tally:', error);
        return NextResponse.json({ error: 'Failed to export tally' }, { status: 500 });
    }
}
