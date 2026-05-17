import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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

  const statusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      paused: 'bg-amber-100 text-amber-700',
      completed: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.completed}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your outreach sequences</p>
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
          {[1, 2].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📬</p>
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create one above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="card p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {c.prospect_count} prospect{c.prospect_count !== 1 ? 's' : ''} •
                    Created {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary text-xs" onClick={() => navigate(`/campaigns/${c.id}`)}>
                  View →
                </button>
                <button
                  className="text-xs px-3 py-2 rounded-lg border font-medium transition-colors border-gray-300 hover:bg-gray-50 text-gray-600"
                  onClick={() => toggleStatus(c)}
                >
                  {c.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button className="btn-danger text-xs" onClick={() => deleteCampaign(c)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
