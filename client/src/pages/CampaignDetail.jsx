import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

// ─── Config ──────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'all',           label: 'All Stages',     color: null      },
  { key: 'pending',       label: 'Queue',          color: '#94a3b8' },
  { key: 'sent',          label: 'Sent',           color: '#6366f1' },
  { key: 'opened',        label: 'Opened',         color: '#3b82f6' },
  { key: 'hot',           label: 'Hot',            color: '#f97316' },
  { key: 'replied',       label: 'Replied',        color: '#8b5cf6' },
  { key: 'interested',    label: 'Interested',     color: '#10b981' },
  { key: 'not_interested',label: 'Not Interested', color: '#ef4444' },
];

const STATUS_BADGE = {
  hot:           { label: 'Hot 🔥',       bg: '#fff7ed', color: '#c2410c' },
  interested:    { label: 'Interested',   bg: '#f5f3ff', color: '#6d28d9' },
  replied:       { label: 'Replied',      bg: '#f5f3ff', color: '#7c3aed' },
  opened:        { label: 'Opened',       bg: '#eff6ff', color: '#1d4ed8' },
  sent:          { label: 'Sent',         bg: '#eef2ff', color: '#4338ca' },
  pending:       { label: 'Queue',        bg: '#f8fafc', color: '#64748b' },
  not_interested:{ label: 'Not interested', bg: '#fff1f2', color: '#be123c' },
  completed:     { label: 'Completed',    bg: '#f0fdf4', color: '#166534' },
  bounced:       { label: 'Bounced',      bg: '#fff1f2', color: '#be123c' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function formatNext(dt, status) {
  if (status === 'completed') return <span className="text-xs text-gray-400">Done</span>;
  if (status === 'bounced')   return <span className="text-xs text-red-400">Bounced</span>;
  if (!dt) return <span className="text-xs text-gray-400">—</span>;
  const diff = new Date(dt) - Date.now();
  const mins = Math.round(diff / 60000);
  if (diff < 0) return <span className="text-xs text-amber-600 font-medium">Due now</span>;
  if (mins < 60) return <span className="text-xs text-gray-600">In {mins}m</span>;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return <span className="text-xs text-gray-600">In {hrs}h</span>;
  return <span className="text-xs text-gray-500">In {Math.round(hrs / 24)}d</span>;
}

// ─── Inline email editor ──────────────────────────────────────────────────────

function EmailEditor({ subject, body, onChange }) {
  return (
    <div className="space-y-2">
      <input
        className="input font-medium text-sm"
        placeholder="Subject line"
        value={subject}
        onChange={e => onChange({ subject: e.target.value, body })}
      />
      <textarea
        className="input min-h-[150px] resize-y font-mono text-xs leading-relaxed"
        placeholder="Email body… Use {{first_name}}, {{company}}, {{job_title}}"
        value={body}
        onChange={e => onChange({ subject, body: e.target.value })}
      />
    </div>
  );
}

// ─── Expanded row panel ───────────────────────────────────────────────────────

function ExpandedRow({ prospect, aiEmail, editingAi, onAiChange, onSave, onRegen, onRemove, onStatusChange, onSaveNote, regenerating }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(prospect.notes || '');
  const [savingNote, setSavingNote] = useState(false);

  const handleSaveNote = async () => {
    setSavingNote(true);
    try { await onSaveNote(prospect.id, noteDraft); } finally { setSavingNote(false); }
  };

  const currentEmail = editingAi || aiEmail || { subject: '', body: '' };

  return (
    <div className="bg-slate-50 border-b border-gray-100 px-6 py-5">
      <div className="max-w-3xl">
        {/* Prospect meta */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">
              {[prospect.first_name, prospect.last_name].filter(Boolean).join(' ')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {[prospect.job_title, prospect.company].filter(Boolean).join(' at ')}
            </p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{prospect.email}</p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 font-medium">Stage</label>
            <select
              className="input !w-auto !py-1 text-xs"
              value={prospect.lead_status || 'pending'}
              onChange={e => onStatusChange(prospect.id, e.target.value)}
            >
              {STAGES.filter(s => s.key !== 'all').map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Note toggle */}
          <button
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition-colors"
            onClick={() => setNoteOpen(o => !o)}
          >
            {noteOpen ? 'Hide note' : prospect.notes ? 'Note ✓' : '+ Note'}
          </button>

          {/* Danger */}
          <button
            className="text-xs text-red-400 hover:text-red-600 transition-colors px-2"
            onClick={() => onRemove(prospect.id)}
          >
            Remove
          </button>
        </div>

        {/* Notes */}
        {noteOpen && (
          <div className="mb-4">
            <textarea
              className="input min-h-[64px] resize-y text-sm"
              placeholder="Private notes about this prospect…"
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
            />
            <button
              className="btn-primary text-xs mt-2"
              disabled={savingNote}
              onClick={handleSaveNote}
            >
              {savingNote ? 'Saving…' : 'Save note'}
            </button>
          </div>
        )}

        {/* Email 1 editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email 1 (personalised)</p>
            <div className="flex gap-2">
              <button
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition-colors"
                onClick={() => onRegen(prospect.id)}
                disabled={regenerating}
              >
                {regenerating ? 'Generating…' : '✨ Regenerate with AI'}
              </button>
              <button
                className="btn-primary text-xs py-1.5"
                onClick={() => onSave(prospect.id)}
              >
                Save email
              </button>
            </div>
          </div>

          {currentEmail.subject || currentEmail.body ? (
            <EmailEditor
              subject={currentEmail.subject}
              body={currentEmail.body}
              onChange={({ subject, body }) => onAiChange(prospect.id, { subject, body })}
            />
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
              No email yet — click <strong>✨ Regenerate with AI</strong> to generate one, or type manually above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('prospects'); // 'prospects' | 'sequence'
  const [stageFilter, setStageFilter] = useState('all');
  const [sortBy, setSortBy]       = useState('default'); // 'default' | 'opens' | 'name' | 'status'
  const [expandedId, setExpandedId]   = useState(null);
  const [editingAi, setEditingAi] = useState({});
  const [followups, setFollowups] = useState([
    { sequence_index: 1, subject: '', body: '', delay_days: 3 },
    { sequence_index: 2, subject: '', body: '', delay_days: 7 },
  ]);
  const [saving, setSaving]         = useState(false);
  const [regenerating, setRegen]    = useState({});
  const [updatingStatus, setUpdSt]  = useState({});
  const [toast, setToast]           = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

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
      for (const [pid, t] of Object.entries(d.aiEmails || {})) {
        ae[pid] = { subject: t.subject, body: t.body };
      }
      setEditingAi(ae);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const saveAiEmail = async (pid) => {
    const e = editingAi[pid]; if (!e) return;
    try { await api.updateAiEmail(id, pid, e); showToast('Email saved.'); }
    catch (err) { showToast('Error: ' + err.message); }
  };

  const regenerate = async (pid) => {
    setRegen(p => ({ ...p, [pid]: true }));
    try {
      const res = await api.regenerateEmail(pid, Number(id));
      if (res.ai_email) {
        setEditingAi(p => ({ ...p, [pid]: res.ai_email }));
        showToast('Email regenerated.');
      }
    } catch (err) { showToast(err.message); }
    finally { setRegen(p => ({ ...p, [pid]: false })); }
  };

  const saveFollowups = async () => {
    setSaving(true);
    try { await api.saveFollowups(id, followups.filter(f => f.subject || f.body)); showToast('Sequence saved.'); }
    catch (err) { showToast(err.message); }
    finally { setSaving(false); }
  };

  const removeProspect = async (pid) => {
    if (!confirm('Remove this prospect from the campaign?')) return;
    await api.removeProspect(id, pid);
    if (expandedId === pid) setExpandedId(null);
    load();
  };

  const updateLeadStatus = async (pid, status) => {
    setUpdSt(p => ({ ...p, [pid]: true }));
    try {
      await api.updateLeadStatus(id, pid, status);
      setData(prev => ({
        ...prev,
        prospects: prev.prospects.map(p => p.id === pid ? { ...p, lead_status: status } : p),
      }));
    } catch (err) { showToast(err.message); }
    finally { setUpdSt(p => ({ ...p, [pid]: false })); }
  };

  const saveNote = async (pid, notes) => {
    await api.updateNotes(pid, notes);
    setData(prev => ({
      ...prev,
      prospects: prev.prospects.map(p => p.id === pid ? { ...p, notes } : p),
    }));
    showToast('Note saved.');
  };

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-100 rounded-lg w-48" />
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
  if (!data) return <div className="p-8 text-red-500">Campaign not found.</div>;

  const { campaign, prospects, aiEmails } = data;

  // Stage counts
  const counts = { all: prospects.length };
  for (const s of STAGES.filter(s => s.key !== 'all')) counts[s.key] = 0;
  for (const p of prospects) {
    const k = p.lead_status || 'pending';
    if (counts[k] !== undefined) counts[k]++;
    else counts[k] = 1;
  }

  // Filter
  let visible = stageFilter === 'all' ? [...prospects] : prospects.filter(p => (p.lead_status || 'pending') === stageFilter);

  // Sort
  if (sortBy === 'opens') visible.sort((a, b) => (b.opened_count || 0) - (a.opened_count || 0));
  else if (sortBy === 'name') visible.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
  else if (sortBy === 'status') {
    const order = ['hot', 'interested', 'replied', 'opened', 'sent', 'pending', 'not_interested', 'completed', 'bounced'];
    visible.sort((a, b) => order.indexOf(a.lead_status || 'pending') - order.indexOf(b.lead_status || 'pending'));
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/campaigns')} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
          ←
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 truncate">{campaign.name}</h1>
        <button
          onClick={() => api.updateCampaign(id, { status: campaign.status === 'active' ? 'paused' : 'active' }).then(load)}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
            campaign.status === 'active'
              ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {campaign.status === 'active' ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {[
          { key: 'prospects', label: `Prospects (${prospects.length})` },
          { key: 'sequence',  label: 'Email Sequence' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROSPECTS TAB ─────────────────────────────────────────────────── */}
      {tab === 'prospects' && (
        <>
          {/* Stage filter pills + sort */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {STAGES.map(s => {
              const count = counts[s.key] || 0;
              if (s.key !== 'all' && count === 0) return null;
              const active = stageFilter === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => { setStageFilter(s.key); setExpandedId(null); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    active ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  style={active && s.color ? { background: s.color } : active ? { background: '#1e293b' } : {}}
                >
                  {count} {s.label}
                </button>
              );
            })}

            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-gray-400">Sort by</label>
              <select
                className="input !w-auto !py-1 text-xs"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="default">Default</option>
                <option value="opens">Most opens</option>
                <option value="status">Status</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="grid items-center px-5 py-2.5 border-b border-gray-100 bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase tracking-wide"
              style={{ gridTemplateColumns: '2fr 1.5fr 130px 70px 90px 80px' }}>
              <span>Prospect</span>
              <span>Company / Title</span>
              <span>Stage</span>
              <span className="text-center">Opens</span>
              <span className="text-center">Next send</span>
              <span />
            </div>

            {visible.length === 0 ? (
              <div className="px-5 py-16 text-center text-gray-400">
                <p className="text-3xl mb-3">⊕</p>
                <p className="font-medium">No prospects in this stage</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {visible.map(p => {
                  const isOpen = expandedId === p.id;
                  const cpStatus = p.status; // bounced/completed/pending

                  return (
                    <div key={p.id}>
                      {/* Row */}
                      <div
                        className={`grid items-center px-5 py-3.5 cursor-pointer transition-colors ${isOpen ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                        style={{ gridTemplateColumns: '2fr 1.5fr 130px 70px 90px 80px' }}
                        onClick={() => setExpandedId(isOpen ? null : p.id)}
                      >
                        {/* Name */}
                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}
                          </p>
                          <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{p.email}</p>
                        </div>

                        {/* Company / Title */}
                        <div className="min-w-0 pr-3">
                          <p className="text-sm text-gray-700 truncate">{p.company || '—'}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{p.job_title || ''}</p>
                        </div>

                        {/* Stage */}
                        <div>
                          <StatusBadge status={cpStatus === 'bounced' ? 'bounced' : cpStatus === 'completed' ? 'completed' : (p.lead_status || 'pending')} />
                        </div>

                        {/* Opens */}
                        <div className="text-center">
                          {p.opened_count > 0 ? (
                            <span className={`text-sm font-bold ${p.opened_count >= 2 ? 'text-orange-600' : 'text-blue-600'}`}>
                              {p.opened_count >= 2 ? '🔥' : ''}{p.opened_count}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </div>

                        {/* Next send */}
                        <div className="text-center">
                          {formatNext(p.next_send_at, cpStatus)}
                        </div>

                        {/* Chevron */}
                        <div className="flex justify-end">
                          <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </div>

                      {/* Expanded panel */}
                      {isOpen && (
                        <ExpandedRow
                          prospect={p}
                          aiEmail={aiEmails[p.id]}
                          editingAi={editingAi[p.id]}
                          onAiChange={(pid, val) => setEditingAi(prev => ({ ...prev, [pid]: val }))}
                          onSave={saveAiEmail}
                          onRegen={regenerate}
                          onRemove={removeProspect}
                          onStatusChange={updateLeadStatus}
                          onSaveNote={saveNote}
                          regenerating={regenerating[p.id]}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SEQUENCE TAB ──────────────────────────────────────────────────── */}
      {tab === 'sequence' && (
        <div className="space-y-4 max-w-2xl">
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-700">
            <strong>Email 1</strong> is personalised per prospect using AI. Follow-up emails below use shared templates with <code className="bg-indigo-100 px-1 rounded text-xs">{'{{first_name}}'}</code>, <code className="bg-indigo-100 px-1 rounded text-xs">{'{{company}}'}</code> etc.
          </div>

          {followups.map((fu, idx) => (
            <div key={fu.sequence_index} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
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
                  <span className="text-xs text-gray-400">days from previous</span>
                </div>
              </div>
              <EmailEditor
                subject={fu.subject}
                body={fu.body}
                onChange={({ subject, body }) => {
                  const next = [...followups];
                  next[idx] = { ...fu, subject, body };
                  setFollowups(next);
                }}
              />
            </div>
          ))}

          <button className="btn-primary" onClick={saveFollowups} disabled={saving}>
            {saving ? 'Saving…' : 'Save Sequence'}
          </button>
        </div>
      )}
    </div>
  );
}
