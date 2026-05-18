import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

// ─── Stage config ───────────────────────────────────────────────────────────
const STAGES = [
  { key: 'pending',       label: 'Queue',          color: '#94a3b8' },
  { key: 'sent',          label: 'Outreach Sent',  color: '#6366f1' },
  { key: 'opened',        label: 'Opened',         color: '#3b82f6' },
  { key: 'hot',           label: 'Hot',            color: '#f97316' },
  { key: 'replied',       label: 'Replied',        color: '#8b5cf6' },
  { key: 'interested',    label: 'Interested',     color: '#10b981' },
  { key: 'not_interested',label: 'Not Interested', color: '#ef4444' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));

const LEAD_BADGE = {
  hot:           { label: 'Hot 🔥',       cls: 'bg-orange-100 text-orange-700' },
  interested:    { label: 'Interested',   cls: 'bg-purple-100 text-purple-700' },
  replied:       { label: 'Replied',      cls: 'bg-violet-100 text-violet-700' },
  opened:        { label: 'Opened',       cls: 'bg-green-100 text-green-700'   },
  sent:          { label: 'Sent',         cls: 'bg-indigo-50 text-indigo-600'  },
  not_interested:{ label: 'Not interested', cls: 'bg-red-50 text-red-500'     },
};

function timeAgo(dt) {
  if (!dt) return null;
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Email editor ────────────────────────────────────────────────────────────
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
        className="input min-h-[130px] resize-y font-mono text-xs leading-relaxed"
        placeholder={placeholder}
        value={body}
        onChange={e => onChange({ subject, body: e.target.value })}
      />
    </div>
  );
}

// ─── Prospect card (board view) ───────────────────────────────────────────────
function ProspectCard({ prospect, aiEmail, isExpanded, onToggle, onStatusChange, onRegenerate, onSaveEmail, onRemove, onSaveNote, editingAi, onAiChange, regenerating }) {
  const [noteDraft, setNoteDraft] = useState(prospect.notes || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const badge = LEAD_BADGE[prospect.lead_status];
  const emailPreview = (aiEmail?.body || '').replace(/#+\s/g, '').slice(0, 100);

  const handleSaveNote = async () => {
    setSavingNote(true);
    try { await onSaveNote(prospect.id, noteDraft); } finally { setSavingNote(false); }
  };

  return (
    <div className={`bg-white rounded-xl border transition-all ${isExpanded ? 'border-indigo-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
      {/* Card header — always visible */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="font-semibold text-gray-900 text-sm leading-tight">
            {[prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || prospect.email}
          </p>
          {badge && (
            <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {[prospect.job_title, prospect.company].filter(Boolean).join(' · ')}
        </p>
        {emailPreview && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{emailPreview}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400 font-mono">{prospect.email}</p>
          {prospect.opened_count > 0 && (
            <span className="text-xs text-gray-400">{prospect.opened_count} open{prospect.opened_count !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Status + actions row */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="input !w-auto !py-1 text-xs flex-shrink-0"
              value={prospect.lead_status || 'pending'}
              onChange={e => onStatusChange(prospect.id, e.target.value)}
            >
              {STAGES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              onClick={() => setNoteOpen(o => !o)}
            >
              {noteOpen ? 'Hide note' : (prospect.notes ? 'Note ✓' : 'Add note')}
            </button>
            <div className="flex-1" />
            <button
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              onClick={() => onRegenerate(prospect.id)}
              disabled={regenerating}
            >
              {regenerating ? '…' : '✨ Regen'}
            </button>
            <button
              className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              onClick={() => onSaveEmail(prospect.id)}
            >
              Save
            </button>
            <button
              className="text-xs px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
              onClick={() => onRemove(prospect.id)}
            >
              Remove
            </button>
          </div>

          {/* Notes */}
          {noteOpen && (
            <div>
              <textarea
                className="input min-h-[64px] resize-y text-xs"
                placeholder="Notes about this prospect…"
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
              />
              <button
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white mt-1.5"
                disabled={savingNote}
                onClick={handleSaveNote}
              >
                {savingNote ? 'Saving…' : 'Save note'}
              </button>
            </div>
          )}

          {/* Email editor */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Email 1 (AI-generated)</p>
            {editingAi?.subject || editingAi?.body ? (
              <EmailEditor
                subject={editingAi.subject || ''}
                body={editingAi.body || ''}
                placeholder="Write email body…"
                onChange={({ subject, body }) => onAiChange(prospect.id, { subject, body })}
              />
            ) : (
              <div className="border-2 border-dashed border-gray-100 rounded-xl p-4 text-center text-gray-400 text-xs">
                No email yet. Click <strong>✨ Regen</strong> to generate with AI.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'
  const [stageFilter, setStageFilter] = useState('all');
  const [editingAi, setEditingAi] = useState({});
  const [followups, setFollowups] = useState([
    { sequence_index: 1, subject: '', body: '', delay_days: 3 },
    { sequence_index: 2, subject: '', body: '', delay_days: 7 },
  ]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState({});
  const [expandedCard, setExpandedCard] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [updatingStatus, setUpdatingStatus] = useState({});

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.getCampaign(id);
      setData(d);
      if (d.followUps?.length) {
        setFollowups(prev => prev.map(fu => {
          const ex = d.followUps.find(f => f.sequence_index === fu.sequence_index);
          return ex ? { ...fu, ...ex } : fu;
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
      showToast('Email saved.');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const regenerate = async (prospectId) => {
    setRegenerating(prev => ({ ...prev, [prospectId]: true }));
    try {
      const res = await api.regenerateEmail(prospectId, Number(id));
      if (res.ai_email) {
        setEditingAi(prev => ({ ...prev, [prospectId]: res.ai_email }));
        showToast('Email regenerated.');
      }
    } catch (err) { showToast(err.message, 'error'); }
    finally { setRegenerating(prev => ({ ...prev, [prospectId]: false })); }
  };

  const saveFollowups = async () => {
    setSaving(true);
    try {
      await api.saveFollowups(id, followups.filter(f => f.subject || f.body));
      showToast('Follow-ups saved.');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
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
    } catch (err) { showToast(err.message, 'error'); }
    finally { setUpdatingStatus(prev => ({ ...prev, [prospectId]: false })); }
  };

  const saveNote = async (prospectId, notes) => {
    await api.updateNotes(prospectId, notes);
    setData(prev => ({
      ...prev,
      prospects: prev.prospects.map(p => p.id === prospectId ? { ...p, notes } : p),
    }));
    showToast('Note saved.');
  };

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-100 rounded-xl w-1/3" />
      <div className="flex gap-3">
        {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-100 rounded-full w-28" />)}
      </div>
      <div className="flex gap-4">
        {[1,2,3,4].map(i => <div key={i} className="flex-1 h-64 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
  if (!data) return <div className="p-8 text-red-500">Campaign not found.</div>;

  const { campaign, prospects, aiEmails } = data;

  // Stage counts for tabs
  const stageCounts = {};
  for (const s of STAGES) stageCounts[s.key] = 0;
  for (const p of prospects) {
    const k = p.lead_status || 'pending';
    stageCounts[k] = (stageCounts[k] || 0) + 1;
  }

  const filteredProspects = stageFilter === 'all'
    ? prospects
    : prospects.filter(p => (p.lead_status || 'pending') === stageFilter);

  // Group for board
  const grouped = {};
  for (const s of STAGES) {
    grouped[s.key] = prospects.filter(p => (p.lead_status || 'pending') === s.key);
  }

  const toastBg = toast.type === 'error'
    ? 'bg-red-600'
    : 'bg-gray-900';

  return (
    <div>
      {/* Toast */}
      {toast.msg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${toastBg}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/campaigns')} className="text-gray-400 hover:text-gray-700 transition-colors text-sm">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{campaign.name}</h1>
        </div>
        <button
          onClick={() => api.updateCampaign(id, { status: campaign.status === 'active' ? 'paused' : 'active' }).then(load)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            campaign.status === 'active'
              ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
              : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          {campaign.status === 'active' ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>

      {/* Stage tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <button
          onClick={() => setStageFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            stageFilter === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
          }`}
        >
          All Stages · {prospects.length}
        </button>
        {STAGES.filter(s => stageCounts[s.key] > 0 || stageFilter === s.key).map(s => (
          <button
            key={s.key}
            onClick={() => setStageFilter(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              stageFilter === s.key
                ? 'text-white border-transparent'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
            }`}
            style={stageFilter === s.key ? { background: s.color, borderColor: s.color } : {}}
          >
            {stageCounts[s.key]} {s.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('board')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'board' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ⊞ Board
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ☰ List
          </button>
        </div>
      </div>

      {/* Board view */}
      {viewMode === 'board' && (
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-4 min-w-max pb-6">
            {STAGES.map(stage => {
              const cards = grouped[stage.key];
              return (
                <div key={stage.key} className="w-72 flex-shrink-0 flex flex-col">
                  {/* Column header */}
                  <div className="mb-3">
                    <div className="h-0.5 rounded-full mb-3" style={{ background: stage.color }} />
                    <div className="flex items-center justify-between px-0.5">
                      <span className="font-semibold text-gray-700 text-sm">{stage.label}</span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: cards.length > 0 ? stage.color : '#cbd5e1' }}
                      >
                        {cards.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {cards.map(p => (
                      <ProspectCard
                        key={p.id}
                        prospect={p}
                        aiEmail={editingAi[p.id] || aiEmails[p.id]}
                        isExpanded={expandedCard === p.id}
                        onToggle={() => setExpandedCard(expandedCard === p.id ? null : p.id)}
                        onStatusChange={updateLeadStatus}
                        onRegenerate={regenerate}
                        onSaveEmail={saveAiEmail}
                        onRemove={removeProspect}
                        onSaveNote={saveNote}
                        editingAi={editingAi[p.id] || aiEmails[p.id]}
                        onAiChange={(pid, val) => setEditingAi(prev => ({ ...prev, [pid]: val }))}
                        regenerating={regenerating[p.id]}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="border-2 border-dashed border-gray-100 rounded-xl py-10 text-center text-gray-400 text-xs">
                        No candidates
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Follow-up sequence */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Follow-up Sequence</h2>
              <p className="text-xs text-gray-400">
                Tokens:{' '}
                {['{{first_name}}', '{{company}}', '{{job_title}}'].map(t => (
                  <code key={t} className="bg-gray-100 px-1 rounded text-gray-600 mr-1">{t}</code>
                ))}
              </p>
            </div>
            <div className="space-y-5">
              {followups.map((fu, idx) => (
                <div key={fu.sequence_index} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      Email {fu.sequence_index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Send after</span>
                      <input
                        type="number" min={1}
                        className="input !w-14 text-center text-xs"
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
                    placeholder={`Follow-up ${fu.sequence_index + 1}… Use {{first_name}}, {{company}}, {{job_title}}`}
                    onChange={({ subject, body }) => {
                      const next = [...followups];
                      next[idx] = { ...fu, subject, body };
                      setFollowups(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <button className="btn-primary mt-4 text-sm" onClick={saveFollowups} disabled={saving}>
              {saving ? 'Saving…' : 'Save Follow-ups'}
            </button>
          </div>

          {/* Prospect list */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                Prospects
                {stageFilter !== 'all' && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    — {STAGE_MAP[stageFilter]?.label}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">{filteredProspects.length} shown</p>
            </div>

            {filteredProspects.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p>No prospects in this stage.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredProspects.map(p => {
                  const aiEdit = editingAi[p.id] || aiEmails[p.id] || { subject: '', body: '' };
                  const badge = LEAD_BADGE[p.lead_status];
                  return (
                    <div key={p.id} className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap mb-1">
                            <p className="font-semibold text-gray-900">{p.first_name} {p.last_name}</p>
                            {badge && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )}
                            {p.opened_count > 0 && (
                              <span className="text-xs text-gray-400">{p.opened_count} opens</span>
                            )}
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
                            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                          <button className="btn-secondary text-xs py-1" onClick={() => regenerate(p.id)} disabled={regenerating[p.id]}>
                            {regenerating[p.id] ? '…' : '✨ Regen'}
                          </button>
                          <button className="btn-primary text-xs py-1" onClick={() => saveAiEmail(p.id)}>Save</button>
                          <button className="btn-danger text-xs py-1" onClick={() => removeProspect(p.id)}>×</button>
                        </div>
                      </div>
                      {aiEdit.subject || aiEdit.body ? (
                        <EmailEditor
                          subject={aiEdit.subject}
                          body={aiEdit.body}
                          onChange={({ subject, body }) => setEditingAi(prev => ({ ...prev, [p.id]: { subject, body } }))}
                        />
                      ) : (
                        <div className="border-2 border-dashed border-gray-100 rounded-xl p-4 text-center text-gray-400 text-sm">
                          No email yet — click <strong>✨ Regen</strong> to generate with AI.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
