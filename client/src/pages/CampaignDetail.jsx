import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const LEAD_STATUS_CONFIG = {
  hot:           { label: 'Hot',          bg: 'bg-orange-100', text: 'text-orange-700' },
  interested:    { label: 'Interested',   bg: 'bg-purple-100', text: 'text-purple-700' },
  replied:       { label: 'Replied',      bg: 'bg-green-100',  text: 'text-green-700'  },
  opened:        { label: 'Opened',       bg: 'bg-blue-100',   text: 'text-blue-700'   },
  sent:          { label: 'Sent',         bg: 'bg-gray-100',   text: 'text-gray-600'   },
  pending:       { label: 'Pending',      bg: 'bg-gray-50',    text: 'text-gray-500'   },
  not_interested:{ label: 'Not interested', bg: 'bg-red-50',   text: 'text-red-500'    },
};

const CP_STATUS_CONFIG = {
  pending:   { label: 'In sequence', color: 'text-indigo-600' },
  completed: { label: 'Completed',   color: 'text-green-600'  },
  bounced:   { label: 'Bounced',     color: 'text-red-500'    },
};

const LEAD_STATUSES = ['pending', 'sent', 'opened', 'hot', 'replied', 'interested', 'not_interested'];

function LeadBadge({ status }) {
  const cfg = LEAD_STATUS_CONFIG[status] || LEAD_STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

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
  const [msg, setMsg] = useState({ text: '', type: 'info' });
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [expandedNotes, setExpandedNotes] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNote, setSavingNote] = useState({});

  const showMsg = (text, type = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'info' }), 3000);
  };

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
      showMsg('Email saved.', 'success');
    } catch (err) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const regenerate = async (prospectId) => {
    setRegenerating(prev => ({ ...prev, [prospectId]: true }));
    try {
      const res = await api.regenerateEmail(prospectId, Number(id));
      if (res.ai_email) {
        setEditingAi(prev => ({ ...prev, [prospectId]: res.ai_email }));
        showMsg('Email regenerated.', 'success');
      }
    } catch (err) {
      showMsg('Error: ' + err.message, 'error');
    } finally {
      setRegenerating(prev => ({ ...prev, [prospectId]: false }));
    }
  };

  const saveFollowups = async () => {
    setSaving(true);
    try {
      const toSave = followups.filter(f => f.subject || f.body);
      await api.saveFollowups(id, toSave);
      showMsg('Follow-ups saved.', 'success');
    } catch (err) {
      showMsg('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeProspect = async (prospectId) => {
    if (!confirm('Remove this prospect from the campaign?')) return;
    await api.removeProspect(id, prospectId);
    load();
  };

  const updateLeadStatus = async (prospectId, status) => {
    setUpdatingStatus(prev => ({ ...prev, [prospectId]: true }));
    try {
      await api.updateLeadStatus(id, prospectId, status);
      setData(prev => ({
        ...prev,
        prospects: prev.prospects.map(p =>
          p.id === prospectId ? { ...p, lead_status: status } : p
        ),
      }));
    } catch (err) {
      showMsg('Error: ' + err.message, 'error');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [prospectId]: false }));
    }
  };

  const saveNote = async (prospectId) => {
    const note = noteDrafts[prospectId] ?? '';
    setSavingNote(prev => ({ ...prev, [prospectId]: true }));
    try {
      await api.updateNotes(prospectId, note);
      setData(prev => ({
        ...prev,
        prospects: prev.prospects.map(p =>
          p.id === prospectId ? { ...p, notes: note } : p
        ),
      }));
      showMsg('Note saved.', 'success');
    } catch (err) {
      showMsg('Error saving note.', 'error');
    } finally {
      setSavingNote(prev => ({ ...prev, [prospectId]: false }));
    }
  };

  if (loading) return <div className="animate-pulse p-8 text-gray-400">Loading…</div>;
  if (!data) return <div className="p-8 text-red-500">Campaign not found.</div>;

  const { campaign, prospects, aiEmails } = data;

  const msgBg = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/campaigns')} className="text-gray-400 hover:text-gray-700 text-sm transition-colors">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{campaign.name}</h1>
          <p className="text-gray-400 text-sm">{prospects.length} prospect{prospects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => api.updateCampaign(id, { status: campaign.status === 'active' ? 'paused' : 'active' }).then(load)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            campaign.status === 'active'
              ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
              : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          {campaign.status === 'active' ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>

      {msg.text && (
        <div className={`mb-4 px-4 py-2 border rounded-lg text-sm ${msgBg[msg.type]}`}>{msg.text}</div>
      )}

      {/* Follow-up sequence */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Follow-up Sequence</h2>
          <p className="text-xs text-gray-400">
            Tokens:{' '}
            {['{{first_name}}', '{{company}}', '{{job_title}}'].map(t => (
              <code key={t} className="bg-gray-100 px-1 py-0.5 rounded text-gray-600 mr-1">{t}</code>
            ))}
          </p>
        </div>
        <div className="space-y-6">
          {followups.map((fu, idx) => (
            <div key={fu.sequence_index} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  Email {fu.sequence_index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Send after</span>
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
                  <span className="text-xs text-gray-400">days</span>
                </div>
              </div>
              <EmailEditor
                subject={fu.subject}
                body={fu.body}
                placeholder={`Follow-up email ${fu.sequence_index + 1}… Use {{first_name}}, {{company}}, {{job_title}}`}
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

      {/* Prospects */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Prospects & Email 1</h2>
          <p className="text-xs text-gray-400">{prospects.length} total</p>
        </div>

        {prospects.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-3">⊕</p>
            <p>No prospects yet. Add some from the Prospects page.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {prospects.map(p => {
              const aiEdit = editingAi[p.id] || aiEmails[p.id] || { subject: '', body: '' };
              const isRegen = regenerating[p.id];
              const isNoteOpen = expandedNotes[p.id];
              const draft = noteDrafts[p.id] ?? p.notes ?? '';
              const cpStatus = CP_STATUS_CONFIG[p.status] || CP_STATUS_CONFIG.pending;

              return (
                <div key={p.id} className="p-6">
                  {/* Prospect header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                        <LeadBadge status={p.lead_status || 'pending'} />
                        {p.opened_count > 0 && (
                          <span className="text-xs text-gray-400">{p.opened_count} open{p.opened_count !== 1 ? 's' : ''}</span>
                        )}
                        <span className={`text-xs font-medium ${cpStatus.color}`}>{cpStatus.label}</span>
                      </div>
                      <p className="text-sm text-gray-500">{p.job_title} at {p.company}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{p.email}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      <select
                        className="input !w-auto !py-1 text-xs"
                        value={p.lead_status || 'pending'}
                        disabled={updatingStatus[p.id]}
                        onChange={e => updateLeadStatus(p.id, e.target.value)}
                      >
                        {LEAD_STATUSES.map(s => (
                          <option key={s} value={s}>{LEAD_STATUS_CONFIG[s]?.label || s}</option>
                        ))}
                      </select>
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => {
                          if (!isNoteOpen && !noteDrafts.hasOwnProperty(p.id)) {
                            setNoteDrafts(prev => ({ ...prev, [p.id]: p.notes || '' }));
                          }
                          setExpandedNotes(prev => ({ ...prev, [p.id]: !isNoteOpen }));
                        }}
                      >
                        {isNoteOpen ? 'Hide note' : (p.notes ? 'Note ✓' : 'Note')}
                      </button>
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => regenerate(p.id)}
                        disabled={isRegen}
                      >
                        {isRegen ? 'Generating…' : '✨ Regen'}
                      </button>
                      <button className="btn-primary text-xs" onClick={() => saveAiEmail(p.id)}>
                        Save
                      </button>
                      <button className="btn-danger text-xs" onClick={() => removeProspect(p.id)}>
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  {isNoteOpen && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                      <textarea
                        className="input min-h-[72px] resize-y text-sm bg-white"
                        placeholder="Notes about this prospect…"
                        value={draft}
                        onChange={e => setNoteDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <button
                        className="btn-primary text-xs mt-2"
                        disabled={savingNote[p.id]}
                        onClick={() => saveNote(p.id)}
                      >
                        {savingNote[p.id] ? 'Saving…' : 'Save note'}
                      </button>
                    </div>
                  )}

                  {/* Email editor */}
                  {aiEdit.subject || aiEdit.body ? (
                    <EmailEditor
                      subject={aiEdit.subject}
                      body={aiEdit.body}
                      placeholder="No email generated yet — click Regen or write manually"
                      onChange={({ subject, body }) =>
                        setEditingAi(prev => ({ ...prev, [p.id]: { subject, body } }))
                      }
                    />
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-gray-400 text-sm">
                      No email yet. Click <strong>✨ Regen</strong> to generate one with AI, or type manually.
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
