import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../api';

interface Stats {
  totalFiles: number;
  totalSize: number;
  typeBreakdown: { type: string; count: number; size: number }[];
}

interface HistoryEntry {
  date: string;
  count: number;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');

  const loadStats = () => {
    setLoading(true);
    Promise.all([
      api.get('/stats'),
      api.get('/stats/history', { params: { days: 30 } }),
    ])
      .then(([statsRes, historyRes]) => {
        setStats(statsRes.data);
        setHistory(historyRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult('');
    try {
      const res = await api.post('/sync');
      setSyncResult(res.data.message);
      loadStats();
    } catch {
      setSyncResult('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-gray-500 text-sm">Loading stats...</div>
    );
  }

  if (!stats) {
    return <div className="text-red-400 text-sm">Failed to load stats</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Dashboard</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {syncing ? 'Syncing...' : 'Sync Files from Disk'}
        </button>
      </div>

      {syncResult && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-800 rounded-lg text-green-400 text-sm">
          {syncResult}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
            Total Files
          </p>
          <p className="text-2xl font-bold text-white">{stats.totalFiles}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
            Total Size
          </p>
          <p className="text-2xl font-bold text-white">
            {formatBytes(stats.totalSize)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
            Media Types
          </p>
          <p className="text-2xl font-bold text-white">
            {stats.typeBreakdown.length}
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            Upload Activity (Last 30 Days)
          </h3>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const parts = d.split('-');
                    return `${parts[1]}/${parts[2]}`;
                  }}
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(value?: number, name?: string) => {
                    const v = value ?? 0;
                    if (name === 'size') return [formatBytes(v), 'Size'];
                    return [v, 'Files'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  fill="url(#colorCount)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-white mb-4">
        Breakdown by Type
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.typeBreakdown.map((t) => (
          <div
            key={t.type}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5"
          >
            <p className="text-gray-400 text-sm capitalize mb-2">{t.type}</p>
            <div className="flex justify-between items-baseline">
              <span className="text-xl font-bold text-white">{t.count}</span>
              <span className="text-gray-500 text-sm">
                {formatBytes(t.size)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
