import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function StatusBadge({ status }) {
  const cfg = {
    active:    { label: 'Active',    cls: 'bg-emerald-100 text-emerald-700' },
    paused:    { label: 'Paused',    cls: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Completed', cls: 'bg-gray-100 text-gray-500' },
  }[status] || { label: status, cls: 'bg-gray-100 text-gray-500' };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => api.getCampaigns().then(setCampaigns).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const createCampaign = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createCampaign(newName.trim());
      setNewName('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (c) => {
    const next = c.status === 'active' ? 'paused' : 'active';
    await api.updateCampaign(c.id, { status: next });
    load();
  };

  const deleteCampaign = async (c) => {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    await api.deleteCampaign(c.id);
    load();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage your outreach sequences</p>
      </div>

      <div className="card p-5 mb-6">
        <form onSubmit={createCampaign} className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="New campaign name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={creating}>
            {creating ? 'Creating…' : '+ New Campaign'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse h-20">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-50 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📬</div>
          <p className="font-semibold text-gray-700">No campaigns yet</p>
          <p className="text-sm text-gray-400 mt-1">Create one above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div
              key={c.id}
              className="card p-5 flex items-center justify-between gap-4 hover:border-gray-300 transition-colors cursor-pointer"
              onClick={() => navigate(`/campaigns/${c.id}`)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: c.status === 'active' ? '#6366f1' : '#94a3b8' }}
                >
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {c.prospect_count} prospect{c.prospect_count !== 1 ? 's' : ''} ·
                    Created {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors border-gray-200 hover:bg-gray-50 text-gray-600"
                  onClick={() => toggleStatus(c)}
                >
                  {c.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors border-gray-200 hover:bg-gray-50 text-gray-600"
                  onClick={() => navigate(`/campaigns/${c.id}`)}
                >
                  View →
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
                  onClick={() => deleteCampaign(c)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
