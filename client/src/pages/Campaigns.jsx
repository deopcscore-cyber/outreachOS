import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const STATUS_CONFIG = {
  active:    { label: 'Active',    dot: '#10b981', bar: '#10b981' },
  paused:    { label: 'Paused',    dot: '#f59e0b', bar: '#f59e0b' },
  completed: { label: 'Completed', dot: '#94a3b8', bar: '#94a3b8' },
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const load = () => api.getCampaigns().then(setCampaigns).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const createCampaign = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const c = await api.createCampaign(newName.trim());
      setNewName('');
      setShowForm(false);
      await load();
      navigate(`/campaigns/${c.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (e, c) => {
    e.stopPropagation();
    await api.updateCampaign(c.id, { status: c.status === 'active' ? 'paused' : 'active' });
    load();
  };

  const deleteCampaign = async (e, c) => {
    e.stopPropagation();
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    await api.deleteCampaign(c.id);
    load();
  };

  const total = campaigns.length;
  const active = campaigns.filter(c => c.status === 'active').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Campaigns
            <span className="ml-2 text-sm font-normal text-gray-400">{total} total</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(f => !f)}
            className="btn-primary"
          >
            + New Campaign
          </button>
        </div>
      </div>

      {/* Summary tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[
          { label: 'All', count: total, active: true },
          { label: 'Active', count: active, color: '#10b981' },
          { label: 'Paused', count: campaigns.filter(c => c.status === 'paused').length, color: '#f59e0b' },
        ].map(({ label, count, color }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-600"
          >
            {color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
            <span>{count} {label}</span>
          </div>
        ))}
      </div>

      {/* New campaign form */}
      {showForm && (
        <div className="card p-5 mb-4">
          <form onSubmit={createCampaign} className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="Campaign name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary whitespace-nowrap" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse h-20">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-50 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-20 text-center">
          <p className="text-4xl mb-4">📬</p>
          <p className="font-semibold text-gray-700">No campaigns yet</p>
          <p className="text-sm text-gray-400 mt-1">Click <strong>+ New Campaign</strong> to get started</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-24">Prospects</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-24">Status</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-28">Created</span>
            <span className="w-36" />
          </div>

          <div className="divide-y divide-gray-50">
            {campaigns.map(c => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.completed;
              return (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-5 py-4 hover:bg-gray-50/60 cursor-pointer transition-colors"
                  onClick={() => navigate(`/campaigns/${c.id}`)}
                >
                  {/* Name + bar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: cfg.bar }} />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    </div>
                  </div>

                  {/* Prospect count */}
                  <div className="text-center w-24">
                    <span className="text-sm font-semibold text-gray-700">{c.prospect_count}</span>
                    <p className="text-xs text-gray-400">prospects</p>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center w-24">
                    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: cfg.dot + '18', color: cfg.dot }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Created */}
                  <div className="text-center w-28">
                    <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 w-36 justify-end" onClick={e => e.stopPropagation()}>
                    <button
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
                      onClick={e => toggleStatus(e, c)}
                    >
                      {c.status === 'active' ? '⏸' : '▶'}
                    </button>
                    <button
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                    >
                      Open →
                    </button>
                    <button
                      className="text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                      onClick={e => deleteCampaign(e, c)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
