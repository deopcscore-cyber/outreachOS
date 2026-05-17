import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

function EmailEditor({ subject, body, onChange, placeholder = '' }) {
  return (
    <div className="space-y-2">
      <input
        className="input font-medium"
        placeholder="Subject line"
        value={subject}
        onChange={e => onChange({ subject: e.target.value, body })}
      />
      <textarea
        className="input min-h-[140px] resize-y font-mono text-xs leading-relaxed"
        placeholder={placeholder || 'Email body…'}
        value={body}
        onChange={e => onChange({ subject, body: e.target.value })}
      />
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingAi, setEditingAi] = useState({});
  const [followups, setFollowups] = useState([
    { sequence_index: 1, subject: '', body: '', delay_days: 3 },
    { sequence_index: 2, subject: '', body: '', delay_days: 7 },
  ]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState({});
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.getCampaign(id);
      setData(d);
      if (d.followUps?.length) {
        setFollowups(prev => prev.map(fu => {
          const existing = d.followUps.find(f => f.sequence_index === fu.sequence_index);
          return existing ? { ...fu, ...existing } : fu;
        }));
      }
      // Seed editingAi from stored ai emails
      const ae = {};
      for (const [pid, tmpl] of Object.entries(d.aiEmails || {})) {
        ae[pid] = { subject: tmpl.subject, body: tmpl.body };
      }
      setEditingAi(ae);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const saveAiEmail = async (prospectId) => {
    const edit = editingAi[prospectId];
    if (!edit) return;
    try {
      await api.updateAiEmail(id, prospectId, edit);
      setMsg('Email saved.');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
  };

  const regenerate = async (prospectId) => {
    setRegenerating(prev => ({ ...prev, [prospectId]: true }));
    try {
      const res = await api.regenerateEmail(prospectId, Number(id));
      if (res.ai_email) {
        setEditingAi(prev => ({ ...prev, [prospectId]: res.ai_email }));
        setMsg('Email regenerated.');
        setTimeout(() => setMsg(''), 2000);
      }
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setRegenerating(prev => ({ ...prev, [prospectId]: false }));
    }
  };

  const saveFollowups = async () => {
    setSaving(true);
    try {
      const toSave = followups.filter(f => f.subject || f.body);
      await api.saveFollowups(id, toSave);
      setMsg('Follow-ups saved.');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeProspect = async (prospectId) => {
    if (!confirm('Remove this prospect from the campaign?')) return;
    await api.removeProspect(id, prospectId);
    load();
  };

  if (loading) return <div className="animate-pulse p-8 text-gray-400">Loading…</div>;
  if (!data) return <div className="p-8 text-red-500">Campaign not found.</div>;

  const { campaign, prospects, aiEmails } = data;

  const statusColor = { pending: 'text-blue-600', completed: 'text-green-600', bounced: 'text-red-500' };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/campaigns')} className="text-gray-400 hover:text-gray-700 text-sm">← Back</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="text-gray-500 text-sm">{prospects.length} prospects</p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">{msg}</div>
      )}

      {/* Follow-up sequence */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Follow-up Sequence</h2>
        <p className="text-xs text-gray-400 mb-4">
          Tokens: <code className="bg-gray-100 px-1 rounded">{'{first_name}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{company}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{job_title}'}</code>
        </p>
        <div className="space-y-6">
          {followups.map((fu, idx) => (
            <div key={fu.sequence_index} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">
                  Email {fu.sequence_index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Send after</label>
                  <input
                    type="number"
                    min={1}
                    className="input !w-16 text-center text-xs"
                    value={fu.delay_days}
                    onChange={e => {
                      const next = [...followups];
                      next[idx] = { ...fu, delay_days: Number(e.target.value) };
                      setFollowups(next);
                    }}
                  />
                  <label className="text-xs text-gray-500">days</label>
                </div>
              </div>
              <EmailEditor
                subject={fu.subject}
                body={fu.body}
                placeholder={`Follow-up email ${fu.sequence_index + 1} body… Use {first_name}, {company}, {job_title}`}
                onChange={({ subject, body }) => {
                  const next = [...followups];
                  next[idx] = { ...fu, subject, body };
                  setFollowups(next);
                }}
              />
            </div>
          ))}
        </div>
        <button className="btn-primary mt-4" onClick={saveFollowups} disabled={saving}>
          {saving ? 'Saving…' : 'Save Follow-ups'}
        </button>
      </div>

      {/* Prospects list */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Prospects & Email 1 (AI-generated)</h2>
        </div>

        {prospects.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p>No prospects yet. Add some from the Prospect Search page.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {prospects.map(p => {
              const aiEdit = editingAi[p.id] || aiEmails[p.id] || { subject: '', body: '' };
              const isRegen = regenerating[p.id];
              return (
                <div key={p.id} className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                      <p className="text-sm text-gray-500">{p.job_title} at {p.company}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{p.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium ${statusColor[p.status] || 'text-gray-500'}`}>
                        {p.status}
                      </span>
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => regenerate(p.id)}
                        disabled={isRegen}
                      >
                        {isRegen ? 'Generating…' : '✨ Regenerate'}
                      </button>
                      <button
                        className="btn-primary text-xs"
                        onClick={() => saveAiEmail(p.id)}
                      >
                        Save
                      </button>
                      <button
                        className="btn-danger text-xs"
                        onClick={() => removeProspect(p.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {aiEdit.subject || aiEdit.body ? (
                    <EmailEditor
                      subject={aiEdit.subject}
                      body={aiEdit.body}
                      placeholder="No email generated yet — click Regenerate or write manually"
                      onChange={({ subject, body }) =>
                        setEditingAi(prev => ({ ...prev, [p.id]: { subject, body } }))
                      }
                    />
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center text-gray-400 text-sm">
                      No AI email yet. Click <strong>Regenerate</strong> to generate one, or click Save after typing manually.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
