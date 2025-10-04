import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { turso } from '@/lib/db/client';

interface TableStats {
  rowCount: number;
  sizeBytes: number;
  indexes: number;
  avgRowSize: number;
}

interface DatabaseMetrics {
  totalSize: number;
  pageCount: number;
  pageSize: number;
  cacheSize: number;
  journalMode: string;
  synchronous: string;
}

export async function GET() {
  try {
    const session = await auth();

    // User must be logged in and be an admin
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const startTime = Date.now();

    // Get detailed table statistics
    const tables = ['users', 'events', 'registrations'];
    const tableStats: Record<string, TableStats> = {};

    for (const table of tables) {
      try {
        // Get row count
        const countResult = await turso.execute({
          sql: `SELECT COUNT(*) as count FROM ${table}`,
          args: []
        });
        const rowCount = Number(countResult.rows[0]?.count) || 0;

        // Get table size estimate (rough calculation)
        const sizeResult = await turso.execute({
          sql: `SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`,
          args: []
        });
        const tableSize = Number(sizeResult.rows[0]?.size) || 0;

        // Get index information
        const indexResult = await turso.execute({
          sql: `SELECT COUNT(*) as index_count FROM pragma_index_list('${table}')`,
          args: []
        });
        const indexCount = Number(indexResult.rows[0]?.index_count) || 0;

        tableStats[table] = {
          rowCount,
          sizeBytes: tableSize,
          indexes: indexCount,
          avgRowSize: rowCount > 0 ? Math.round(tableSize / rowCount) : 0
        };
      } catch (error) {
        console.error(`Error getting stats for ${table}:`, error);
        tableStats[table] = {
          rowCount: 0,
          sizeBytes: 0,
          indexes: 0,
          avgRowSize: 0
        };
      }
    }

    // Get database performance metrics
    let dbMetrics: DatabaseMetrics = {
      totalSize: 0,
      pageCount: 0,
      pageSize: 0,
      cacheSize: 0,
      journalMode: 'unknown',
      synchronous: 'unknown'
    };

    try {
      const metricsResult = await turso.execute({
        sql: `
          SELECT
            (SELECT page_count FROM pragma_page_count()) as page_count,
            (SELECT page_size FROM pragma_page_size()) as page_size,
            (SELECT cache_size FROM pragma_cache_size) as cache_size,
            (SELECT journal_mode FROM pragma_journal_mode) as journal_mode,
            (SELECT synchronous FROM pragma_synchronous) as synchronous
        `,
        args: []
      });

      const row = metricsResult.rows[0];
      dbMetrics = {
        totalSize: Number(row?.page_count || 0) * Number(row?.page_size || 0),
        pageCount: Number(row?.page_count || 0),
        pageSize: Number(row?.page_size || 0),
        cacheSize: Number(row?.cache_size || 0),
        journalMode: String(row?.journal_mode || 'unknown'),
        synchronous: String(row?.synchronous || 'unknown')
      };
    } catch (error) {
      console.error('Error getting database metrics:', error);
    }

    // Get query performance (recent activity)
    const recentActivity = {
      lastHour: { queries: 0, errors: 0 },
      lastDay: { queries: 0, errors: 0 },
      lastWeek: { queries: 0, errors: 0 }
    };

    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

    try {
      // Count recent registrations as proxy for activity
      const hourResult = await turso.execute({
        sql: `SELECT COUNT(*) as count FROM registrations WHERE created_at > ?`,
        args: [hourAgo]
      });
  recentActivity.lastHour.queries = Number(hourResult.rows[0]?.count || 0);

      const dayResult = await turso.execute({
        sql: `SELECT COUNT(*) as count FROM registrations WHERE created_at > ?`,
        args: [dayAgo]
      });
  recentActivity.lastDay.queries = Number(dayResult.rows[0]?.count || 0);

      const weekResult = await turso.execute({
        sql: `SELECT COUNT(*) as count FROM registrations WHERE created_at > ?`,
        args: [weekAgo]
      });
  recentActivity.lastWeek.queries = Number(weekResult.rows[0]?.count || 0);

    } catch (error) {
      console.error('Error getting activity metrics:', error);
    }

    // Get system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external
      },
      environment: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.DATABASE_URL ? 'Configured' : 'Not configured'
    };

    // Calculate response time
    const responseTime = Date.now() - startTime;

      return NextResponse.json({
        database: {
          ...dbMetrics,
          tables: tableStats,
          totalRows: Object.values(tableStats).reduce((sum: number, table: TableStats) => sum + table.rowCount, 0)
        },
        performance: {
          responseTime,
          queriesPerSecond: recentActivity.lastHour.queries / 3600,
        },
        activity: recentActivity,
        system: systemInfo,
      });

  } catch (error) {
    console.error('Error fetching system analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system analytics' },
      { status: 500 }
    );
  }
}