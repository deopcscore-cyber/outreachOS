import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Real Estate', 'Legal',
  'Marketing', 'Consulting', 'Education', 'Retail', 'Manufacturing',
  'Media', 'Construction', 'Logistics', 'Energy', 'Other',
];

// Robust CSV parser — handles quoted fields with embedded newlines/commas
function parseCsv(text) {
  // Tokenise the entire file character-by-character so quoted multi-line cells work
  const rows = [];
  let cur = '';
  let inQuotes = false;
  let row = [];

  const text2 = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text2.length; i++) {
    const ch = text2[i];
    const next = text2[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cur += '"'; i++; } // escaped quote
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cur); cur = '';
    } else if (ch === '\n' && !inQuotes) {
      row.push(cur); cur = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur || row.length) { row.push(cur); if (row.some(c => c.trim())) rows.push(row); }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  // Map common export column names to our field names
  const alias = {
    first_name: 'first_name', last_name: 'last_name',
    firstname: 'first_name', lastname: 'last_name',
    title: 'job_title', job_title: 'job_title', jobtitle: 'job_title',
    work_email: 'work_email', personal_email: 'personal_email',
    email: 'email', email_address: 'email',
    organization: 'company', company: 'company', employer: 'company',
    industry: 'industry', sector: 'industry',
    seniority: 'seniority', seniority_level: 'seniority',
    location: 'location', country: 'country', region: 'country',
    linkedin_url: 'linkedin_url',
  };
  const normalize = h => alias[h] || h;

  return rows.slice(1).map(cols => {
    const row = {};
    headers.forEach((h, i) => { row[normalize(h)] = (cols[i] ?? '').trim(); });

    // Resolve email: prefer work email, fall back to personal email
    if (!row.email) row.email = row.work_email || row.personal_email || '';

    // Resolve country from location ("Dallas, Texas, United States" → "United States")
    if (!row.country && row.location) {
      const parts = row.location.split(',').map(s => s.trim());
      row.country = parts[parts.length - 1] || row.location;
    }

    return row;
  }).filter(r => r.email);
}

export default function ProspectSearch() {
  const [tab, setTab] = useState('search');

  // Search state
  const [form, setForm] = useState({ job_title: '', industry: '', country: 'UK', limit: 20 });
  const [loading, setLoading] = useState(false);

  // CSV state
  const fileRef = useRef();
  const [csvError, setCsvError] = useState('');

  // Shared state — results persisted in sessionStorage so navigation doesn't wipe them
  const [results, setResults] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('prospect_results') || '[]'); } catch { return []; }
  });
  const [selected, setSelected] = useState(new Set());
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [adding, setAdding] = useState(false);
  const [addErrors, setAddErrors] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getCampaigns().then(setCampaigns).catch(console.error);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('prospect_results', JSON.stringify(results));
  }, [results]);

  const resetResults = () => { setResults([]); setSelected(new Set()); setError(''); setSuccess(''); setAddErrors([]); };

  // --- Search tab ---
  const search = async (e) => {
    e.preventDefault();
    setError('');
    resetResults();
    setLoading(true);
    try {
      const data = await api.searchProspects(form);
      const contacts = data.results || data.data || data.contacts || data || [];
      setResults(Array.isArray(contacts) ? contacts : []);
      if (!contacts.length) setError('No prospects found. Try different filters.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CSV tab ---
  const handleFile = (e) => {
    setCsvError('');
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setCsvError('Please upload a .csv file.'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target.result);
      if (!rows.length) {
        setCsvError('No valid rows found. Make sure your CSV has an "email" column and at least one data row.');
        return;
      }
      resetResults();
      setResults(rows);
    };
    reader.readAsText(file);
  };

  // --- Shared selection & add-to-campaign ---
  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(selected.size === results.length ? new Set() : new Set(results.map((_, i) => i)));
  };

  const addToCampaign = async () => {
    if (!selectedCampaign) { setError('Please select a campaign'); return; }
    if (!selected.size) { setError('Please select at least one prospect'); return; }
    setAdding(true);
    setError('');
    setSuccess('');
    setAddErrors([]);

    let added = 0;
    let aiWarning = '';
    const errs = [];

    for (const idx of selected) {
      const p = results[idx];
      const label = p.email || `row ${idx + 1}`;
      try {
        if (!p.email) throw new Error('No email address');
        const saved = await api.saveProspect({
          first_name: p.first_name || p.firstName || '',
          last_name: p.last_name || p.lastName || '',
          email: p.email,
          job_title: p.job_title || p.jobTitle || p.title || '',
          company: p.company || p.organization || '',
          industry: p.industry || (tab === 'search' ? form.industry : ''),
          seniority: p.seniority || '',
          country: p.country || (tab === 'search' ? form.country : ''),
        });
        const addRes = await api.addToCampaign(saved.id, Number(selectedCampaign));
        if (addRes.ai_error) aiWarning = addRes.ai_error;
        added++;
      } catch (err) {
        errs.push(`${label}: ${err.message}`);
      }
    }

    setAdding(false);
    if (added > 0) {
      setSuccess(`Added ${added} prospect${added !== 1 ? 's' : ''} to campaign.${aiWarning ? ' Note: ' + aiWarning : ''}`);
    }
    if (errs.length) setAddErrors(errs);
    setSelected(new Set());
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Prospect Search</h1>
        <p className="text-gray-500 text-sm mt-0.5">Search via Prospeo API or upload a CSV</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[{ id: 'search', label: 'Search Prospeo' }, { id: 'csv', label: 'Upload CSV' }].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); resetResults(); setCsvError(''); if (fileRef.current) fileRef.current.value = ''; }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search panel */}
      {tab === 'search' && (
        <div className="card p-6 mb-6">
          <form onSubmit={search} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Job Title</label>
              <input className="input" placeholder="e.g. Marketing Manager" value={form.job_title}
                onChange={e => setForm({ ...form, job_title: e.target.value })} />
            </div>
            <div>
              <label className="label">Industry</label>
              <select className="input" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}>
                <option value="">Any</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
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
              <label className="label">Number of Results (max 100)</label>
              <input className="input" type="number" min={1} max={100} value={form.limit}
                onChange={e => setForm({ ...form, limit: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Searching...' : 'Search Prospects'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV upload panel */}
      {tab === 'csv' && (
        <div className="card p-6 mb-6">
          <p className="text-sm text-gray-600 mb-4">
            Upload a CSV with columns: <span className="font-mono text-xs bg-gray-100 px-1 rounded">email</span> (required),
            plus any of: <span className="font-mono text-xs bg-gray-100 px-1 rounded">first_name</span>{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">last_name</span>{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">job_title</span>{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">company</span>{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">industry</span>{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">country</span>{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">seniority</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
          {csvError && <p className="mt-3 text-sm text-red-600">{csvError}</p>}
          {results.length > 0 && <p className="mt-3 text-sm text-green-600">{results.length} rows loaded from CSV.</p>}
        </div>
      )}

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}
      {addErrors.length > 0 && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <p className="font-medium mb-1">Some prospects failed to add:</p>
          <ul className="list-disc list-inside space-y-0.5">{addErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="btn-secondary text-xs">
                {selected.size === results.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-sm text-gray-500">{results.length} prospect{results.length !== 1 ? 's' : ''}</span>
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-3">
                <select className="input !w-auto" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                  <option value="">Select campaign…</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn-primary" onClick={addToCampaign} disabled={adding}>
                  {adding ? 'Adding...' : `Add ${selected.size} to Campaign`}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left w-8"></th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Job Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((p, i) => (
                  <tr key={i} className={`hover:bg-gray-50 cursor-pointer ${selected.has(i) ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleSelect(i)}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)}
                        className="rounded border-gray-300 text-blue-600" onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {[p.first_name || p.firstName, p.last_name || p.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.job_title || p.jobTitle || p.title || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.company || p.organization || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
