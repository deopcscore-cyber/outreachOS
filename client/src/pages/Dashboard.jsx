import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function StatCard({ label, value, sub, accent = '#6366f1', onClick }) {
  return (
    <div
      className={`card p-5 flex flex-col gap-3 ${onClick ? 'cursor-pointer hover:border-indigo-200 transition-colors' : ''}`}
      onClick={onClick}
    >
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

function NextSendTimer({ nextSendAt, paused, outsideWindow }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const update = () => {
      if (paused) { setLabel('Paused'); return; }
      if (outsideWindow) { setLabel('Outside send window'); return; }
      if (!nextSendAt) { setLabel('Ready — waiting for next cron tick'); return; }
      const diff = new Date(nextSendAt) - Date.now();
      if (diff <= 0) { setLabel('Ready — waiting for next cron tick'); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setLabel(mins > 0 ? `Next email in ~${mins}m ${secs}s` : `Next email in ${secs}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [nextSendAt, paused, outsideWindow]);

  return <span className="text-xs font-mono text-gray-400">{label}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getDashboard(), api.getDiagnostics()])
      .then(([s, d]) => {
        setStats(s);
        setDiag(d);
        setPaused(d.info?.sending_paused === 'true' || s?.sending_paused === 'true');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Also check pause state from settings
  useEffect(() => {
    api.getSettings().then(s => { if (s.sending_paused === 'true') setPaused(true); }).catch(() => {});
  }, []);

  const togglePause = async () => {
    setToggling(true);
    const next = !paused;
    try {
      await api.saveSettings({ sending_paused: String(next) });
      setPaused(next);
      load();
    } catch (err) { console.error(err); }
    finally { setToggling(false); }
  };

  const triggerSend = async () => {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const res = await api.triggerSend();
      setTriggerMsg(res.message || 'Send triggered — check your Gmail sent folder.');
      setTimeout(() => { setTriggerMsg(''); load(); }, 4000);
    } catch (err) {
      setTriggerMsg('Error: ' + err.message);
      setTimeout(() => setTriggerMsg(''), 4000);
    } finally {
      setTriggering(false);
    }
  };

  const pct = stats ? Math.min(100, (stats.sent_today / stats.daily_limit) * 100) : 0;
  const outsideWindow = diag?.issues?.some(i => i.includes('Outside sending window'));

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Overview of your outreach</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerSend}
            disabled={triggering || paused}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            {triggering ? 'Sending…' : '⚡ Send now'}
          </button>
          <button
            onClick={togglePause}
            disabled={toggling}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              paused
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            }`}
          >
            {paused ? '▶  Resume sending' : '⏸  Pause sending'}
          </button>
        </div>
      </div>

      {/* Trigger message */}
      {triggerMsg && (
        <div className="mb-4 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-sm">
          {triggerMsg}
        </div>
      )}

      {/* Pause banner */}
      {paused && (
        <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2">
          <span>⚠</span> Sending is paused — no emails will go out until you resume.
        </div>
      )}

      {/* Diagnostics panel */}
      {!loading && diag && (
        <div className={`mb-5 card p-4 ${diag.ok || paused ? 'border-emerald-200' : 'border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${paused ? 'bg-amber-400' : diag.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="text-sm font-semibold text-gray-700">
              {paused ? 'Sending paused' : diag.ok ? 'Sending is active' : 'Sending may be blocked'}
            </span>
            <span className="ml-auto text-xs text-gray-400">{diag.info?.server_time_utc} · Window: {diag.info?.send_window}</span>
          </div>

          {/* Issues */}
          {diag.issues?.length > 0 && !paused && (
            <ul className="space-y-1 mb-3">
              {diag.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                  <span className="mt-0.5 flex-shrink-0">⚠</span> {issue}
                </li>
              ))}
            </ul>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Active campaigns', value: diag.info?.active_campaigns },
              { label: 'Emails due now', value: diag.info?.emails_due },
              { label: `Sent today`, value: `${diag.info?.sent_today} / ${diag.info?.daily_limit}` },
              { label: 'Next send', value: diag.info?.cooldown },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-400 mb-0.5">{label}</p>
                <p className="font-semibold text-gray-700">{value ?? '—'}</p>
              </div>
            ))}
          </div>

          {outsideWindow && !paused && (
            <p className="mt-3 text-xs text-amber-600">
              ⚠ The server runs in <strong>UTC</strong>. If you're in the UK (BST = UTC+1), set your window 1 hour earlier — e.g. 08:00–16:00 UTC to send 09:00–17:00 your time.
              <a href="/settings" className="underline ml-1">Edit in Settings →</a>
            </p>
          )}
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse h-28">
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard label="Sent today" value={stats.sent_today} sub={`limit: ${stats.daily_limit}`} accent="#6366f1" />
          <StatCard label="Open rate" value={`${stats.open_rate}%`} sub="All time" accent="#10b981" />
          <StatCard label="Reply rate" value={`${stats.reply_rate}%`} sub="All time" accent="#8b5cf6" />
          <StatCard label="Warm leads" value={stats.warm_leads ?? 0} sub="Click to view" accent="#f97316"
            onClick={() => navigate('/warm-leads')} />
        </div>
      ) : null}

      {/* Progress bar */}
      {stats && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Daily send usage</p>
            <div className="flex items-center gap-4">
              <NextSendTimer nextSendAt={stats.next_send_at} paused={paused} outsideWindow={outsideWindow} />
              <p className="text-sm text-gray-400">{stats.sent_today} / {stats.daily_limit}</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : '#6366f1' }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Drip mode: one email every 5–10 min. <strong>⚡ Send now</strong> bypasses the cooldown.
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Quick actions</p>
          <div className="space-y-3">
            {[
              { href: '/prospects', label: 'Import or manage contacts' },
              { href: '/campaigns', label: 'View campaigns' },
              { href: '/outbox', label: 'Preview scheduled emails' },
              { href: '/warm-leads', label: 'See who opened your emails' },
              { href: '/settings', label: 'Configure Gmail, send window, ebook' },
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
              'Add Gmail app password in Settings',
              'Set send window to your timezone (in UTC)',
              'Add ebook URL in Settings → Ebook Delivery',
              'Import prospects (CSV) and add to a campaign',
              'Emails drip out every 5–10 min automatically',
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
