import { useState, useEffect } from 'react';
import { api } from '../api';

const STATUS_CONFIG = {
  hot:           { label: 'Hot',         bg: 'bg-orange-100', text: 'text-orange-700', dot: '#f97316' },
  interested:    { label: 'Interested',  bg: 'bg-purple-100', text: 'text-purple-700', dot: '#9333ea' },
  replied:       { label: 'Replied',     bg: 'bg-green-100',  text: 'text-green-700',  dot: '#16a34a' },
  opened:        { label: 'Opened',      bg: 'bg-blue-100',   text: 'text-blue-700',   dot: '#2563eb' },
  sent:          { label: 'Sent',        bg: 'bg-gray-100',   text: 'text-gray-600',   dot: '#9ca3af' },
  pending:       { label: 'Pending',     bg: 'bg-gray-100',   text: 'text-gray-500',   dot: '#d1d5db' },
  not_interested:{ label: 'Not interested', bg: 'bg-red-50', text: 'text-red-500',    dot: '#ef4444' },
};

const STATUSES = ['opened', 'hot', 'replied', 'interested', 'not_interested'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function timeAgo(dt) {
  if (!dt) return '—';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WarmLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNote, setSavingNote] = useState({});
  const [updatingStatus, setUpdatingStatus] = useState({});

  const load = () => {
    api.getWarmLeads()
      .then(setLeads)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (lead, status) => {
    const key = `${lead.cp_id}`;
    setUpdatingStatus(prev => ({ ...prev, [key]: true }));
    try {
      await api.updateLeadStatus(lead.campaign_id, lead.prospect_id, status);
      setLeads(prev => prev.map(l =>
        l.cp_id === lead.cp_id ? { ...l, lead_status: status } : l
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [key]: false }));
    }
  };

  const saveNote = async (lead) => {
    const note = noteDrafts[lead.prospect_id] ?? lead.notes ?? '';
    setSavingNote(prev => ({ ...prev, [lead.prospect_id]: true }));
    try {
      await api.updateNotes(lead.prospect_id, note);
      setLeads(prev => prev.map(l =>
        l.prospect_id === lead.prospect_id ? { ...l, notes: note } : l
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(prev => ({ ...prev, [lead.prospect_id]: false }));
    }
  };

  const hot = leads.filter(l => l.lead_status === 'hot');
  const rest = leads.filter(l => l.lead_status !== 'hot');

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warm Leads</h1>
          <p className="text-gray-400 text-sm mt-0.5">Prospects who opened your emails — strike while the iron is hot</p>
        </div>
        <button onClick={load} className="btn-secondary text-xs">Refresh</button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse h-24">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">🔥</div>
          <p className="font-semibold text-gray-700 text-lg">No warm leads yet</p>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            When prospects open your emails, they'll appear here. Keep sending!
          </p>
        </div>
      ) : (
        <>
          {hot.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-orange-500 text-lg">🔥</span>
                <h2 className="font-semibold text-gray-800">Hot — opened 2+ times</h2>
                <span className="ml-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{hot.length}</span>
              </div>
              <div className="space-y-3">
                {hot.map(lead => <LeadCard key={lead.cp_id} lead={lead} onStatusChange={updateStatus} updatingStatus={updatingStatus} expandedNotes={expandedNotes} setExpandedNotes={setExpandedNotes} noteDrafts={noteDrafts} setNoteDrafts={setNoteDrafts} savingNote={savingNote} onSaveNote={saveNote} />)}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              {hot.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-semibold text-gray-800">Warm — opened once</h2>
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{rest.length}</span>
                </div>
              )}
              <div className="space-y-3">
                {rest.map(lead => <LeadCard key={lead.cp_id} lead={lead} onStatusChange={updateStatus} updatingStatus={updatingStatus} expandedNotes={expandedNotes} setExpandedNotes={setExpandedNotes} noteDrafts={noteDrafts} setNoteDrafts={setNoteDrafts} savingNote={savingNote} onSaveNote={saveNote} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeadCard({ lead, onStatusChange, updatingStatus, expandedNotes, setExpandedNotes, noteDrafts, setNoteDrafts, savingNote, onSaveNote }) {
  const isNoteOpen = expandedNotes[lead.prospect_id];
  const draft = noteDrafts[lead.prospect_id] ?? lead.notes ?? '';
  const updating = updatingStatus[lead.cp_id];

  return (
    <div className={`card overflow-hidden ${lead.lead_status === 'hot' ? 'border-orange-200' : ''}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <p className="font-semibold text-gray-900">
                {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email}
              </p>
              <StatusBadge status={lead.lead_status} />
              {lead.opened_count > 0 && (
                <span className="text-xs text-gray-400">{lead.opened_count} open{lead.opened_count !== 1 ? 's' : ''}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {[lead.job_title, lead.company].filter(Boolean).join(' at ')}
            </p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{lead.email}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>Campaign: <span className="text-gray-600 font-medium">{lead.campaign_name}</span></span>
              {lead.last_opened_at && <span>Last opened: {timeAgo(lead.last_opened_at)}</span>}
              <span>{lead.emails_sent} email{lead.emails_sent !== 1 ? 's' : ''} sent</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              className="input !w-auto !py-1 text-xs"
              value={lead.lead_status}
              disabled={updating}
              onChange={e => onStatusChange(lead, e.target.value)}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
              ))}
            </select>
            <button
              className="btn-secondary text-xs"
              onClick={() => setExpandedNotes(prev => ({ ...prev, [lead.prospect_id]: !isNoteOpen }))}
            >
              {isNoteOpen ? 'Hide note' : (lead.notes ? 'View note' : 'Add note')}
            </button>
          </div>
        </div>
      </div>

      {isNoteOpen && (
        <div className="border-t border-gray-100 p-5 bg-gray-50">
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[80px] resize-y text-sm"
            placeholder="Add a note about this prospect…"
            value={draft}
            onChange={e => setNoteDrafts(prev => ({ ...prev, [lead.prospect_id]: e.target.value }))}
          />
          <button
            className="btn-primary text-xs mt-2"
            disabled={savingNote[lead.prospect_id]}
            onClick={() => onSaveNote(lead)}
          >
            {savingNote[lead.prospect_id] ? 'Saving…' : 'Save note'}
          </button>
        </div>
      )}
    </div>
  );
}
