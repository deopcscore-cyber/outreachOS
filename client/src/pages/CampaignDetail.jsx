import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

// ─── Pipeline stages ──────────────────────────────────────────────────────────
// These match the ebook outreach funnel exactly
const PIPELINE = [
  { id: 'queue',    keys: ['pending'],           label: 'Queue',           color: '#94a3b8', desc: 'Not yet sent' },
  { id: 'sent',     keys: ['sent'],              label: 'Outreach Sent',   color: '#6366f1', desc: 'Waiting for a response' },
  { id: 'opened',   keys: ['opened', 'hot'],     label: 'Opened',         color: '#3b82f6', desc: 'Opened your email' },
  { id: 'replied',  keys: ['replied'],           label: 'Replied 💬',     color: '#8b5cf6', desc: 'They replied — send the PDF!' },
  { id: 'pdf_sent', keys: ['pdf_sent'],          label: 'PDF Sent ✅',    color: '#10b981', desc: 'Ebook delivered' },
  { id: 'closed',   keys: ['not_interested'],    label: 'Not Interested', color: '#ef4444', desc: 'Closed' },
];

const ALL_STATUSES = [
  { key: 'pending',        label: 'Queue'          },
  { key: 'sent',           label: 'Outreach Sent'  },
  { key: 'opened',         label: 'Opened'         },
  { key: 'hot',            label: 'Hot'            },
  { key: 'replied',        label: 'Replied'        },
  { key: 'pdf_sent',       label: 'PDF Sent'       },
  { key: 'interested',     label: 'Interested'     },
  { key: 'not_interested', label: 'Not Interested' },
];

const STATUS_BADGE = {
  hot:           { label: 'Hot 🔥',      bg: '#fff7ed', color: '#c2410c' },
  interested:    { label: 'Interested',  bg: '#f5f3ff', color: '#6d28d9' },
  replied:       { label: 'Replied',     bg: '#f5f3ff', color: '#7c3aed' },
  opened:        { label: 'Opened',      bg: '#eff6ff', color: '#1d4ed8' },
  sent:          { label: 'Sent',        bg: '#eef2ff', color: '#4338ca' },
  pending:       { label: 'Queue',       bg: '#f8fafc', color: '#64748b' },
  pdf_sent:      { label: 'PDF Sent ✅', bg: '#f0fdf4', color: '#166534' },
  not_interested:{ label: 'Not interested', bg: '#fff1f2', color: '#be123c' },
  completed:     { label: 'Completed',   bg: '#f0fdf4', color: '#166534' },
  bounced:       { label: 'Bounced',     bg: '#fff1f2', color: '#be123c' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function formatNext(dt, status) {
  if (status === 'completed') return <span className="text-xs text-gray-400">Done</span>;
  if (status === 'bounced')   return <span className="text-xs text-red-400">Bounced</span>;
  if (!dt) return <span className="text-xs text-gray-400">—</span>;
  const diff = new Date(dt) - Date.now();
  if (diff < 0) return <span className="text-xs text-amber-600 font-medium">Due now</span>;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return <span className="text-xs text-gray-600">In {mins}m</span>;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return <span className="text-xs text-gray-600">In {hrs}h</span>;
  return <span className="text-xs text-gray-500">In {Math.round(hrs / 24)}d</span>;
}

function EmailEditor({ subject, body, onChange }) {
  return (
    <div className="space-y-2">
      <input className="input font-medium text-sm" placeholder="Subject line" value={subject}
        onChange={e => onChange({ subject: e.target.value, body })} />
      <textarea className="input min-h-[140px] resize-y font-mono text-xs leading-relaxed"
        placeholder="Email body… Use {{first_name}}, {{company}}, {{job_title}}"
        value={body} onChange={e => onChange({ subject, body: e.target.value })} />
    </div>
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────
function BoardCard({ prospect, aiEmail, campaignId, onStatusChange, onSendPdf, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);

  const isReplied = prospect.lead_status === 'replied';
  const emailPreview = (aiEmail?.body || '').replace(/#+\s/g, '').slice(0, 90);
  const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || prospect.email;
  const badge = STATUS_BADGE[prospect.lead_status];

  const doSendPdf = async () => {
    setSending(true);
    try {
      await onSendPdf(prospect.id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border transition-all ${
      isReplied ? 'border-purple-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{name}</p>
          {prospect.lead_status && prospect.lead_status !== 'sent' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: badge?.bg, color: badge?.color }}>
              {badge?.label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {[prospect.job_title, prospect.company].filter(Boolean).join(' · ')}
        </p>
        {emailPreview && (
          <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{emailPreview}</p>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <p className="text-xs text-gray-400 font-mono truncate">{prospect.email}</p>
          {prospect.opened_count > 0 && (
            <span className="text-xs font-semibold text-orange-600 ml-2">
              {prospect.opened_count >= 2 ? '🔥' : '👁'} {prospect.opened_count}
            </span>
          )}
        </div>
      </div>

      {/* Replied CTA — always visible on replied cards */}
      {isReplied && !expanded && (
        <div className="px-4 pb-4">
          <button
            onClick={doSendPdf}
            disabled={sending}
            className="w-full py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending PDF…' : '📖 Send PDF / Ebook'}
          </button>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select className="input !w-auto !py-1 text-xs"
              value={prospect.lead_status || 'pending'}
              onChange={e => onStatusChange(prospect.id, e.target.value)}>
              {ALL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            {isReplied && (
              <button onClick={doSendPdf} disabled={sending}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors">
                {sending ? '…' : '📖 Send PDF'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expanded row (table view) ────────────────────────────────────────────────
function ExpandedRow({ prospect, aiEmail, editingAi, onAiChange, onSave, onRegen, onRemove, onStatusChange, onSaveNote, onSendPdf, regenerating }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(prospect.notes || '');
  const [savingNote, setSavingNote] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);

  const handleSaveNote = async () => {
    setSavingNote(true);
    try { await onSaveNote(prospect.id, noteDraft); } finally { setSavingNote(false); }
  };

  const handleSendPdf = async () => {
    setSendingPdf(true);
    try { await onSendPdf(prospect.id); } catch (err) { alert(err.message); } finally { setSendingPdf(false); }
  };

  const currentEmail = editingAi || aiEmail || { subject: '', body: '' };

  return (
    <div className="bg-slate-50 border-b border-gray-100 px-6 py-5">
      <div className="max-w-3xl">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{[prospect.first_name, prospect.last_name].filter(Boolean).join(' ')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{[prospect.job_title, prospect.company].filter(Boolean).join(' at ')}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{prospect.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-500">Stage</label>
            <select className="input !w-auto !py-1 text-xs" value={prospect.lead_status || 'pending'}
              onChange={e => onStatusChange(prospect.id, e.target.value)}>
              {ALL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            {prospect.lead_status === 'replied' && (
              <button onClick={handleSendPdf} disabled={sendingPdf}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700">
                {sendingPdf ? 'Sending…' : '📖 Send PDF'}
              </button>
            )}
            <button className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white"
              onClick={() => setNoteOpen(o => !o)}>
              {noteOpen ? 'Hide note' : prospect.notes ? 'Note ✓' : '+ Note'}
            </button>
            <button className="text-xs text-red-400 hover:text-red-600 px-2"
              onClick={() => onRemove(prospect.id)}>Remove</button>
          </div>
        </div>

        {noteOpen && (
          <div className="mb-4">
            <textarea className="input min-h-[64px] resize-y text-sm" placeholder="Private notes…"
              value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
            <button className="btn-primary text-xs mt-2" disabled={savingNote} onClick={handleSaveNote}>
              {savingNote ? 'Saving…' : 'Save note'}
            </button>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email 1 (personalised)</p>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white"
                onClick={() => onRegen(prospect.id)} disabled={regenerating}>
                {regenerating ? 'Generating…' : '✨ Regenerate with AI'}
              </button>
              <button className="btn-primary text-xs py-1.5" onClick={() => onSave(prospect.id)}>Save email</button>
            </div>
          </div>
          {currentEmail.subject || currentEmail.body ? (
            <EmailEditor subject={currentEmail.subject} body={currentEmail.body}
              onChange={({ subject, body }) => onAiChange(prospect.id, { subject, body })} />
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
              No email yet — click <strong>✨ Regenerate with AI</strong> or type manually.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('board'); // 'board' | 'prospects' | 'sequence'
  const [stageFilter, setStageFilter] = useState('all');
  const [sortBy, setSortBy]     = useState('default');
  const [expandedId, setExpandedId] = useState(null);
  const [editingAi, setEditingAi] = useState({});
  const [followups, setFollowups] = useState([
    { sequence_index: 1, subject: '', body: '', delay_days: 3 },
    { sequence_index: 2, subject: '', body: '', delay_days: 7 },
  ]);
  const [saving, setSaving]     = useState(false);
  const [regenerating, setRegen]= useState({});
  const [updatingStatus, setUpdSt]= useState({});
  const [toast, setToast]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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
      for (const [pid, t] of Object.entries(d.aiEmails || {})) ae[pid] = { subject: t.subject, body: t.body };
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
      if (res.ai_email) { setEditingAi(p => ({ ...p, [pid]: res.ai_email })); showToast('Email regenerated.'); }
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
    if (!confirm('Remove this prospect?')) return;
    await api.removeProspect(id, pid);
    if (expandedId === pid) setExpandedId(null);
    load();
  };

  const updateLeadStatus = async (pid, status) => {
    setUpdSt(p => ({ ...p, [pid]: true }));
    try {
      await api.updateLeadStatus(id, pid, status);
      setData(prev => ({ ...prev, prospects: prev.prospects.map(p => p.id === pid ? { ...p, lead_status: status } : p) }));
    } catch (err) { showToast(err.message); }
    finally { setUpdSt(p => ({ ...p, [pid]: false })); }
  };

  const sendPdf = async (pid) => {
    await api.sendPdf(id, pid);
    showToast('📖 PDF email sent! Moving to PDF Sent stage.');
    setData(prev => ({ ...prev, prospects: prev.prospects.map(p => p.id === pid ? { ...p, lead_status: 'pdf_sent' } : p) }));
  };

  const saveNote = async (pid, notes) => {
    await api.updateNotes(pid, notes);
    setData(prev => ({ ...prev, prospects: prev.prospects.map(p => p.id === pid ? { ...p, notes } : p) }));
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
  const stageCounts = {};
  for (const p of prospects) {
    const k = p.lead_status || 'pending';
    stageCounts[k] = (stageCounts[k] || 0) + 1;
  }
  const repliedCount = stageCounts['replied'] || 0;

  // Table filter + sort
  const tableStages = [
    { key: 'all', label: 'All Stages' },
    ...PIPELINE.map(s => ({ key: s.id, label: s.label })),
  ];
  let visible = stageFilter === 'all'
    ? [...prospects]
    : prospects.filter(p => {
        const stage = PIPELINE.find(s => s.id === stageFilter);
        return stage ? stage.keys.includes(p.lead_status || 'pending') : (p.lead_status || 'pending') === stageFilter;
      });
  if (sortBy === 'opens') visible.sort((a, b) => (b.opened_count || 0) - (a.opened_count || 0));
  else if (sortBy === 'name') visible.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/campaigns')} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 truncate">{campaign.name}</h1>
        {repliedCount > 0 && (
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold animate-pulse">
            {repliedCount} replied — send PDF!
          </span>
        )}
        <button
          onClick={() => api.updateCampaign(id, { status: campaign.status === 'active' ? 'paused' : 'active' }).then(load)}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
            campaign.status === 'active'
              ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {campaign.status === 'active' ? '⏸ Pause' : '▶ Resume'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {[
          { key: 'board',     label: '⊞ Pipeline Board' },
          { key: 'prospects', label: `☰ All Prospects (${prospects.length})` },
          { key: 'sequence',  label: '✉ Email Sequence' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BOARD TAB ──────────────────────────────────────────────────────────── */}
      {tab === 'board' && (
        <>
          {/* Stage summary pills */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {PIPELINE.map(stage => {
              const count = stage.keys.reduce((n, k) => n + (stageCounts[k] || 0), 0);
              return (
                <div key={stage.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 bg-white"
                  style={{ color: count > 0 ? stage.color : '#94a3b8' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: count > 0 ? stage.color : '#e2e8f0' }} />
                  {count} {stage.label}
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex gap-4 min-w-max pb-6">
              {PIPELINE.map(stage => {
                const cards = prospects.filter(p => stage.keys.includes(p.lead_status || 'pending'));
                return (
                  <div key={stage.id} className="w-72 flex-shrink-0">
                    {/* Column header */}
                    <div className="mb-3">
                      <div className="h-0.5 rounded-full mb-3" style={{ background: stage.color }} />
                      <div className="flex items-center justify-between px-0.5 mb-1">
                        <span className="font-semibold text-gray-700 text-sm">{stage.label}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: cards.length > 0 ? stage.color : '#cbd5e1' }}>
                          {cards.length}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 px-0.5">{stage.desc}</p>
                    </div>

                    <div className="space-y-3">
                      {cards.map(p => (
                        <BoardCard
                          key={p.id}
                          prospect={p}
                          aiEmail={editingAi[p.id] || aiEmails[p.id]}
                          campaignId={id}
                          onStatusChange={updateLeadStatus}
                          onSendPdf={sendPdf}
                          onRefresh={load}
                        />
                      ))}
                      {cards.length === 0 && (
                        <div className="border-2 border-dashed border-gray-100 rounded-xl py-10 text-center text-gray-300 text-xs">
                          No prospects
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── PROSPECTS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'prospects' && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {tableStages.map(s => {
              const stage = PIPELINE.find(ps => ps.id === s.key);
              const count = s.key === 'all'
                ? prospects.length
                : stage ? stage.keys.reduce((n, k) => n + (stageCounts[k] || 0), 0) : 0;
              if (s.key !== 'all' && count === 0) return null;
              const isActive = stageFilter === s.key;
              return (
                <button key={s.key}
                  onClick={() => { setStageFilter(s.key); setExpandedId(null); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    isActive ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  style={isActive ? { background: stage?.color || '#1e293b' } : {}}>
                  {count} {s.label}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-gray-400">Sort</label>
              <select className="input !w-auto !py-1 text-xs" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="default">Default</option>
                <option value="opens">Most opens</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="grid px-5 py-2.5 bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide"
              style={{ gridTemplateColumns: '2fr 1.5fr 130px 70px 90px 60px' }}>
              <span>Prospect</span><span>Company / Title</span><span>Stage</span>
              <span className="text-center">Opens</span><span className="text-center">Next send</span><span />
            </div>

            {visible.length === 0 ? (
              <div className="px-5 py-16 text-center text-gray-400">No prospects in this stage.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {visible.map(p => {
                  const isOpen = expandedId === p.id;
                  return (
                    <div key={p.id}>
                      <div className={`grid items-center px-5 py-3.5 cursor-pointer transition-colors ${isOpen ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}
                        style={{ gridTemplateColumns: '2fr 1.5fr 130px 70px 90px 60px' }}
                        onClick={() => setExpandedId(isOpen ? null : p.id)}>
                        <div className="min-w-0 pr-3">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}
                          </p>
                          <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{p.email}</p>
                        </div>
                        <div className="min-w-0 pr-3">
                          <p className="text-sm text-gray-700 truncate">{p.company || '—'}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{p.job_title || ''}</p>
                        </div>
                        <div>
                          <StatusBadge status={p.status === 'bounced' ? 'bounced' : p.status === 'completed' ? 'completed' : (p.lead_status || 'pending')} />
                        </div>
                        <div className="text-center">
                          {p.opened_count > 0
                            ? <span className={`text-sm font-bold ${p.opened_count >= 2 ? 'text-orange-600' : 'text-blue-600'}`}>{p.opened_count >= 2 ? '🔥' : ''}{p.opened_count}</span>
                            : <span className="text-gray-300 text-sm">—</span>}
                        </div>
                        <div className="text-center">{formatNext(p.next_send_at, p.status)}</div>
                        <div className="flex justify-end">
                          <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </div>
                      {isOpen && (
                        <ExpandedRow
                          prospect={p} aiEmail={aiEmails[p.id]} editingAi={editingAi[p.id]}
                          onAiChange={(pid, val) => setEditingAi(prev => ({ ...prev, [pid]: val }))}
                          onSave={saveAiEmail} onRegen={regenerate} onRemove={removeProspect}
                          onStatusChange={updateLeadStatus} onSaveNote={saveNote} onSendPdf={sendPdf}
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

      {/* ── SEQUENCE TAB ───────────────────────────────────────────────────────── */}
      {tab === 'sequence' && (
        <div className="space-y-4 max-w-2xl">
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-700">
            <strong>Email 1</strong> is AI-personalised per prospect. Follow-ups below are shared templates using{' '}
            <code className="bg-indigo-100 px-1 rounded text-xs">{'{{first_name}}'}</code>,{' '}
            <code className="bg-indigo-100 px-1 rounded text-xs">{'{{company}}'}</code>.
          </div>
          {followups.map((fu, idx) => (
            <div key={fu.sequence_index} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
                  Email {fu.sequence_index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Send after</span>
                  <input type="number" min={1} className="input !w-14 text-center text-xs"
                    value={fu.delay_days}
                    onChange={e => { const n = [...followups]; n[idx] = { ...fu, delay_days: Number(e.target.value) }; setFollowups(n); }} />
                  <span className="text-xs text-gray-400">days</span>
                </div>
              </div>
              <EmailEditor subject={fu.subject} body={fu.body}
                onChange={({ subject, body }) => {
                  const n = [...followups]; n[idx] = { ...fu, subject, body }; setFollowups(n);
                }} />
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
