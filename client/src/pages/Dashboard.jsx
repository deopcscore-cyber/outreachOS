import { useEffect, useState } from 'react';
import { api } from '../api';

function StatCard({ label, value, sub, accent = '#6366f1' }) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));

    if (localStorage.getItem('sendingPaused') === 'true') setPaused(true);
  }, []);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    localStorage.setItem('sendingPaused', String(next));
  };

  const pct = stats ? Math.min(100, (stats.sent_today / stats.daily_limit) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Overview of your outreach</p>
        </div>
        <button
          onClick={togglePause}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
            paused
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
          }`}
        >
          {paused ? '▶  Resume sending' : '⏸  Pause sending'}
        </button>
      </div>

      {paused && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
          <span>⚠</span> Sending is paused — no emails will go out until you resume.
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse h-28">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Sent today" value={stats.sent_today} sub={`limit: ${stats.daily_limit}`} accent="#6366f1" />
          <StatCard label="Open rate" value={`${stats.open_rate}%`} sub="All time" accent="#10b981" />
          <StatCard label="Reply rate" value={`${stats.reply_rate}%`} sub="All time" accent="#8b5cf6" />
          <StatCard label="In queue" value={stats.prospects_in_queue} sub="Pending send" accent="#f59e0b" />
        </div>
      ) : null}

      {/* Send usage bar */}
      {stats && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Daily send usage</p>
            <p className="text-sm text-gray-400">{stats.sent_today} of {stats.daily_limit}</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : '#6366f1' }}
            />
          </div>
        </div>
      )}

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Quick actions</p>
          <div className="space-y-3">
            {[
              { href: '/prospects', label: 'Upload or search for prospects' },
              { href: '/campaigns', label: 'View and manage campaigns' },
              { href: '/outbox', label: 'Preview emails before they send' },
              { href: '/settings', label: 'Configure Gmail and API keys' },
            ].map(({ href, label }) => (
              <a key={href} href={href} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
                <span className="text-gray-300">→</span> {label}
              </a>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Getting started</p>
          <ol className="space-y-2.5">
            {[
              'Add your Gmail and API keys in Settings',
              'Upload a CSV of prospects (Prospects page)',
              'Create a campaign and add your prospects',
              'Write your email sequence, review in Outbox',
              'Emails send automatically every hour',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-500">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
