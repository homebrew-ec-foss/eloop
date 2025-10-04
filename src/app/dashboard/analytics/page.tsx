'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

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
  tables: Record<string, TableStats>;
  totalRows: number;
}

interface PerformanceMetrics {
  responseTime: number;
  queriesPerSecond: number;
  connectionStats: unknown;
  geoDistribution?: {
    regions: Array<{
      region: string;
      connections: number;
      latency: number;
    }>;
  };
}

interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  environment: string;
  databaseUrl: string;
}

interface SystemAnalytics {
  database: DatabaseMetrics;
  performance: PerformanceMetrics;
  activity: {
    lastHour: { queries: number; errors: number };
    lastDay: { queries: number; errors: number };
    lastWeek: { queries: number; errors: number };
  };
  system: SystemInfo;
}

export default function AnalyticsPage() {
  useSession();
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/admin/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p>Error loading analytics: {error}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">System Analytics</h2>
        <div className="text-sm text-gray-500">
          Response time: {analytics.performance.responseTime}ms
        </div>
      </div>

      {/* Database Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Database Size</h3>
          <p className="text-3xl font-bold text-blue-600">{formatBytes(analytics.database.totalSize)}</p>
          <p className="text-sm text-gray-500 mt-1">{analytics.database.pageCount} pages</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Rows</h3>
          <p className="text-3xl font-bold text-green-600">{analytics.database.totalRows.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Across all tables</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">System Uptime</h3>
          <p className="text-3xl font-bold text-orange-600">{formatUptime(analytics.system.uptime)}</p>
          <p className="text-sm text-gray-500 mt-1">Process uptime</p>
        </div>
      </div>

      {/* Table Performance */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Table Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rows</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indexes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Row Size</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(analytics.database.tables).map(([table, stats]) => (
                <tr key={table}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 capitalize">{table}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{stats.rowCount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{formatBytes(stats.sizeBytes)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{stats.indexes}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{formatBytes(stats.avgRowSize)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Query Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Query Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Last Hour</span>
              <span className="font-medium">{analytics.activity.lastHour.queries.toLocaleString()} queries</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Day</span>
              <span className="font-medium">{analytics.activity.lastDay.queries.toLocaleString()} queries</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Week</span>
              <span className="font-medium">{analytics.activity.lastWeek.queries.toLocaleString()} queries</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">QPS</span>
              <span className="font-medium">{analytics.performance.queriesPerSecond.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Memory Usage</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Heap Used</span>
              <span className="font-medium">{formatBytes(analytics.system.memory.heapUsed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Heap Total</span>
              <span className="font-medium">{formatBytes(analytics.system.memory.heapTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">RSS</span>
              <span className="font-medium">{formatBytes(analytics.system.memory.rss)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">External</span>
              <span className="font-medium">{formatBytes(analytics.system.memory.external)}</span>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">System Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Node.js</span>
              <span className="font-medium">{analytics.system.nodeVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Platform</span>
              <span className="font-medium">{analytics.system.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Architecture</span>
              <span className="font-medium">{analytics.system.arch}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Environment</span>
              <span className="font-medium">{analytics.system.environment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Database</span>
              <span className="font-medium">{analytics.system.databaseUrl}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}