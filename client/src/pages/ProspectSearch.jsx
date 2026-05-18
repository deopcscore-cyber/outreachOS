import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let cur = '', inQuotes = false, row = [];
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i], nx = t[i + 1];
    if (ch === '"') {
      if (inQuotes && nx === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { row.push(cur); cur = ''; }
    else if (ch === '\n' && !inQuotes) {
      row.push(cur); cur = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); if (row.some(c => c.trim())) rows.push(row); }
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const alias = {
    first_name: 'first_name', firstname: 'first_name', last_name: 'last_name', lastname: 'last_name',
    title: 'job_title', job_title: 'job_title', jobtitle: 'job_title',
    work_email: 'work_email', personal_email: 'personal_email',
    email: 'email', email_address: 'email',
    organization: 'company', company: 'company', employer: 'company',
    industry: 'industry', sector: 'industry',
    seniority: 'seniority', seniority_level: 'seniority',
    location: 'location', country: 'country', region: 'country',
  };

  return rows.slice(1).map(cols => {
    const row = {};
    headers.forEach((h, i) => { row[alias[h] || h] = (cols[i] ?? '').trim(); });
    if (!row.email) row.email = row.work_email || row.personal_email || '';
    if (!row.country && row.location) {
      const parts = row.location.split(',').map(s => s.trim());
      row.country = parts[parts.length - 1] || row.location;
    }
    return row;
  }).filter(r => r.email);
}

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Real Estate', 'Legal',
  'Marketing', 'Consulting', 'Education', 'Retail', 'Manufacturing',
  'Media', 'Construction', 'Logistics', 'Energy', 'Other',
];

// ─── Small helpers ─────────────────────────────────────────────────────────────
function CampaignBadge({ name }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
      {name}
    </span>
  );
}

function timeAgo(dt) {
  if (!dt) return '';
  const d = Math.floor((Date.now() - new Date(dt)) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function Prospects() {
  // Import panel state
  const [panel, setPanel] = useState(null); // null | 'csv' | 'search'
  const [form, setForm] = useState({ job_title: '', industry: '', country: 'UK', limit: 20 });
  const [searching, setSearching] = useState(false);
  const fileRef = useRef();

  // Import results (temporary, for selection before saving)
  const [importRows, setImportRows] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('prospect_results') || '[]'); } catch { return []; }
  });
  const [selected, setSelected] = useState(new Set());
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [adding, setAdding] = useState(false);
  const [importMsg, setImportMsg] = useState({ text: '', type: '' });

  // Contacts library (persistent, from DB)
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('all'); // 'all' | 'none' | campaign_id

  // Quick-add from contacts table
  const [quickAddId, setQuickAddId] = useState(null);
  const [quickCampaign, setQuickCampaign] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

  useEffect(() => {
    loadContacts();
    api.getCampaigns().then(setCampaigns).catch(console.error);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('prospect_results', JSON.stringify(importRows));
  }, [importRows]);

  const loadContacts = () => {
    setContactsLoading(true);
    api.getProspects()
      .then(setContacts)
      .catch(console.error)
      .finally(() => setContactsLoading(false));
  };

  // ── Import: CSV ──────────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setImportMsg({ text: 'Please upload a .csv file.', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target.result);
      if (!rows.length) { setImportMsg({ text: 'No valid rows found. Make sure your CSV has an "email" column.', type: 'error' }); return; }
      setImportRows(rows);
      setSelected(new Set());
      setImportMsg({ text: `${rows.length} rows loaded from CSV.`, type: 'success' });
    };
    reader.readAsText(file);
  };

  // ── Import: Prospeo search ───────────────────────────────────────────────────
  const doSearch = async (e) => {
    e.preventDefault();
    setImportMsg({ text: '', type: '' });
    setImportRows([]);
    setSelected(new Set());
    setSearching(true);
    try {
      const data = await api.searchProspects(form);
      const rows = data.results || [];
      setImportRows(rows);
      if (!rows.length) setImportMsg({ text: 'No prospects found. Try different filters.', type: 'error' });
      else setImportMsg({ text: `${rows.length} prospects found.`, type: 'success' });
    } catch (err) {
      setImportMsg({ text: err.message, type: 'error' });
    } finally {
      setSearching(false);
    }
  };

  // ── Add selected import rows to campaign ─────────────────────────────────────
  const addSelected = async () => {
    if (!selectedCampaign) { setImportMsg({ text: 'Select a campaign first.', type: 'error' }); return; }
    if (!selected.size) { setImportMsg({ text: 'Select at least one prospect.', type: 'error' }); return; }
    setAdding(true);
    setImportMsg({ text: '', type: '' });

    let added = 0, aiWarn = '', errs = [];
    for (const idx of selected) {
      const p = importRows[idx];
      try {
        if (!p.email) throw new Error('No email');
        const saved = await api.saveProspect({
          first_name: p.first_name || '', last_name: p.last_name || '',
          email: p.email,
          job_title: p.job_title || p.title || '',
          company: p.company || '',
          industry: p.industry || (panel === 'search' ? form.industry : ''),
          seniority: p.seniority || '',
          country: p.country || (panel === 'search' ? form.country : ''),
        });
        const res = await api.addToCampaign(saved.id, Number(selectedCampaign));
        if (res.ai_error) aiWarn = res.ai_error;
        added++;
      } catch (err) {
        errs.push(`${p.email}: ${err.message}`);
      }
    }

    setAdding(false);
    if (added > 0) {
      setImportMsg({
        text: `Added ${added} contact${added !== 1 ? 's' : ''} to campaign.${aiWarn ? ' Note: ' + aiWarn : ''}${errs.length ? ` (${errs.length} failed)` : ''}`,
        type: 'success',
      });
      setSelected(new Set());
      loadContacts(); // refresh the contacts library
    } else {
      setImportMsg({ text: errs.join('; '), type: 'error' });
    }
  };

  // ── Quick add from contacts table ────────────────────────────────────────────
  const quickAdd = async (contactId) => {
    if (!quickCampaign) return;
    setQuickAdding(true);
    try {
      await api.addToCampaign(contactId, Number(quickCampaign));
      setQuickAddId(null);
      setQuickCampaign('');
      loadContacts();
    } catch (err) {
      alert(err.message);
    } finally {
      setQuickAdding(false);
    }
  };

  // ── Filter contacts ───────────────────────────────────────────────────────────
  const visibleContacts = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [c.first_name, c.last_name, c.email, c.company, c.job_title]
      .some(f => (f || '').toLowerCase().includes(q));
    const matchesCampaign = filterCampaign === 'all'
      || (filterCampaign === 'none' && !c.campaign_names)
      || (c.campaign_ids && c.campaign_ids.split(',').includes(filterCampaign));
    return matchesSearch && matchesCampaign;
  });

  const toggleSelect = (i) => {
    setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Prospects
            <span className="ml-2 text-sm font-normal text-gray-400">{contacts.length} saved</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPanel(panel === 'csv' ? null : 'csv')}
            className={`btn-secondary text-sm ${panel === 'csv' ? 'border-indigo-300 text-indigo-700' : ''}`}
          >
            Import CSV
          </button>
          <button
            onClick={() => setPanel(panel === 'search' ? null : 'search')}
            className={`btn-secondary text-sm ${panel === 'search' ? 'border-indigo-300 text-indigo-700' : ''}`}
          >
            Search Prospeo
          </button>
        </div>
      </div>

      {/* ── Import panel ─────────────────────────────────────────────────────── */}
      {panel && (
        <div className="card p-5">
          {panel === 'csv' && (
            <>
              <p className="text-sm text-gray-600 mb-3">
                CSV needs an <code className="bg-gray-100 px-1 rounded text-xs">email</code> column. Optional:{' '}
                {['first_name', 'last_name', 'job_title', 'company', 'industry', 'country', 'seniority'].map(f => (
                  <code key={f} className="bg-gray-100 px-1 rounded text-xs mr-1">{f}</code>
                ))}
              </p>
              <input
                ref={fileRef} type="file" accept=".csv" onChange={handleFile}
                className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </>
          )}

          {panel === 'search' && (
            <form onSubmit={doSearch} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Job Title</label>
                <input className="input" placeholder="e.g. VP Operations" value={form.job_title}
                  onChange={e => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div>
                <label className="label">Industry</label>
                <select className="input" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}>
                  <option value="">Any</option>
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Country</label>
                <select className="input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>
                  <option value="UK">United Kingdom</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <label className="label">Limit</label>
                <input className="input" type="number" min={1} max={100} value={form.limit}
                  onChange={e => setForm({ ...form, limit: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 md:col-span-4">
                <button type="submit" className="btn-primary" disabled={searching}>
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </form>
          )}

          {/* Import results */}
          {importRows.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  onClick={() => setSelected(selected.size === importRows.length ? new Set() : new Set(importRows.map((_, i) => i)))}
                >
                  {selected.size === importRows.length ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-sm text-gray-500">{importRows.length} rows loaded</span>

                {selected.size > 0 && (
                  <div className="ml-auto flex items-center gap-2">
                    {campaigns.length === 0 ? (
                      <span className="text-xs text-amber-600">No campaigns yet. <a href="/campaigns" className="underline">Create one first.</a></span>
                    ) : (
                      <>
                        <select className="input !w-auto !py-1 text-xs" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                          <option value="">Select campaign…</option>
                          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button className="btn-primary text-xs py-1.5" onClick={addSelected} disabled={adding}>
                          {adding ? 'Adding…' : `Add ${selected.size} to campaign`}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {importMsg.text && (
                <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${
                  importMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {importMsg.text}
                </div>
              )}

              {/* Mini table */}
              <div className="rounded-xl border border-gray-100 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8" />
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Title / Company</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {importRows.map((p, i) => (
                      <tr key={i}
                        className={`cursor-pointer transition-colors ${selected.has(i) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleSelect(i)}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selected.has(i)} readOnly
                            className="rounded border-gray-300 text-indigo-600 pointer-events-none" />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {[p.job_title || p.title, p.company].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-400 font-mono text-xs">{p.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Contacts library ──────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Library header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-semibold text-gray-800 text-sm">All Contacts</h2>
            <div className="flex-1 min-w-0 max-w-xs">
              <input
                className="input !py-1.5 text-xs"
                placeholder="Search name, email, company…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={filterCampaign}
              onChange={e => setFilterCampaign(e.target.value)}
            >
              <option value="all">All campaigns</option>
              <option value="none">Not in any campaign</option>
              {campaigns.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <span className="text-xs text-gray-400 ml-auto">{visibleContacts.length} shown</span>
          </div>
        </div>

        {/* Table header */}
        <div className="grid px-5 py-2.5 bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: '2fr 1.5fr 2fr auto 120px' }}>
          <span>Name</span>
          <span>Title / Company</span>
          <span>Email</span>
          <span>Campaigns</span>
          <span />
        </div>

        {contactsLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="h-4 bg-gray-100 rounded flex-1" />
                <div className="h-4 bg-gray-100 rounded flex-1" />
                <div className="h-4 bg-gray-100 rounded flex-1" />
              </div>
            ))}
          </div>
        ) : visibleContacts.length === 0 ? (
          <div className="px-5 py-16 text-center text-gray-400">
            {contacts.length === 0 ? (
              <>
                <p className="text-3xl mb-3">⊕</p>
                <p className="font-medium text-gray-600">No contacts yet</p>
                <p className="text-sm mt-1">Import a CSV or search Prospeo to add your first contacts.</p>
              </>
            ) : (
              <p>No contacts match your search.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {visibleContacts.map(c => {
              const campaignNames = c.campaign_names ? c.campaign_names.split(',') : [];
              const campaignIds   = c.campaign_ids   ? c.campaign_ids.split(',')   : [];
              const isAdding = quickAddId === c.id;

              return (
                <div key={c.id}
                  className="grid items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                  style={{ gridTemplateColumns: '2fr 1.5fr 2fr auto 120px' }}>

                  {/* Name */}
                  <div className="min-w-0 pr-3">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(c.created_at)}</p>
                  </div>

                  {/* Title / Company */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm text-gray-700 truncate">{c.job_title || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{c.company || ''}</p>
                  </div>

                  {/* Email */}
                  <div className="min-w-0 pr-3">
                    <p className="text-xs text-gray-500 font-mono truncate">{c.email}</p>
                  </div>

                  {/* Campaigns */}
                  <div className="flex items-center gap-1.5 flex-wrap pr-3">
                    {campaignNames.length > 0 ? (
                      campaignNames.map((name, i) => (
                        <CampaignBadge key={i} name={name} />
                      ))
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end gap-1.5">
                    {isAdding ? (
                      <>
                        <select
                          className="input !w-auto !py-1 text-xs"
                          value={quickCampaign}
                          onChange={e => setQuickCampaign(e.target.value)}
                          autoFocus
                        >
                          <option value="">Campaign…</option>
                          {campaigns
                            .filter(camp => !campaignIds.includes(String(camp.id)))
                            .map(camp => <option key={camp.id} value={camp.id}>{camp.name}</option>)
                          }
                        </select>
                        <button
                          className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                          disabled={!quickCampaign || quickAdding}
                          onClick={() => quickAdd(c.id)}
                        >
                          {quickAdding ? '…' : 'Add'}
                        </button>
                        <button
                          className="text-xs text-gray-400 hover:text-gray-600 px-1"
                          onClick={() => { setQuickAddId(null); setQuickCampaign(''); }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors whitespace-nowrap"
                        onClick={() => { setQuickAddId(c.id); setQuickCampaign(''); }}
                      >
                        + Campaign
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
