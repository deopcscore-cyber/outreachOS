import { useEffect, useState } from 'react';
import { api } from '../api';

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
  };
  return (
    <div className={`card p-6 border ${colors[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
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

    const p = localStorage.getItem('sendingPaused');
    if (p === 'true') setPaused(true);
  }, []);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    localStorage.setItem('sendingPaused', String(next));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Overview of your outreach activity</p>
        </div>
        <button
          onClick={togglePause}
          className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
            paused
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
        >
          {paused ? '▶ Resume Sending' : '⏸ Pause All Sending'}
        </button>
      </div>

      {paused && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          ⚠️ Sending is currently paused. No emails will be sent until you resume.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Emails Sent Today"
            value={stats.sent_today}
            sub={`of ${stats.daily_limit} daily limit`}
            color="blue"
          />
          <StatCard
            label="Open Rate"
            value={`${stats.open_rate}%`}
            sub="All time"
            color="green"
          />
          <StatCard
            label="Reply Rate"
            value={`${stats.reply_rate}%`}
            sub="All time"
            color="purple"
          />
          <StatCard
            label="In Queue"
            value={stats.prospects_in_queue}
            sub="Prospects pending send"
            color="orange"
          />
        </div>
      ) : (
        <p className="text-gray-500">Could not load stats.</p>
      )}

      {stats && (
        <div className="mt-8 card p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Daily send usage</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (stats.sent_today / stats.daily_limit) * 100)}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              {stats.sent_today} / {stats.daily_limit}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-semibold text-gray-800 mb-3">Quick actions</h2>
          <div className="space-y-2">
            <a href="/prospects" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">🔍 Search for new prospects</a>
            <a href="/campaigns" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">📬 View campaigns</a>
            <a href="/settings" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">⚙️ Configure sending settings</a>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold text-gray-800 mb-3">Getting started</h2>
          <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
            <li>Add your Gmail and API keys in Settings</li>
            <li>Search for prospects via the Prospect Search page</li>
            <li>Create a campaign and add prospects</li>
            <li>Review AI-generated emails and set follow-ups</li>
            <li>Watch the emails send automatically</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
