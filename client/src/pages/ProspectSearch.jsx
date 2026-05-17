import { useState, useEffect } from 'react';
import { api } from '../api';

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Real Estate', 'Legal',
  'Marketing', 'Consulting', 'Education', 'Retail', 'Manufacturing',
  'Media', 'Construction', 'Logistics', 'Energy', 'Other',
];

export default function ProspectSearch() {
  const [form, setForm] = useState({ job_title: '', industry: '', country: 'UK', limit: 20 });
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getCampaigns().then(setCampaigns).catch(console.error);
  }, []);

  const search = async (e) => {
    e.preventDefault();
    setError('');
    setResults([]);
    setSelected(new Set());
    setLoading(true);
    try {
      const data = await api.searchProspects(form);
      // Prospeo returns data.data or data.contacts depending on endpoint
      const contacts = data.data || data.contacts || data.results || data || [];
      setResults(Array.isArray(contacts) ? contacts : []);
      if (Array.isArray(contacts) && contacts.length === 0) setError('No prospects found. Try different filters.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((_, i) => i)));
  };

  const addToCampaign = async () => {
    if (!selectedCampaign) { setError('Please select a campaign'); return; }
    if (selected.size === 0) { setError('Please select at least one prospect'); return; }
    setAdding(true);
    setError('');
    setSuccess('');

    let added = 0;
    let aiWarning = '';
    for (const idx of selected) {
      const p = results[idx];
      try {
        const saved = await api.saveProspect({
          first_name: p.first_name || p.firstName || '',
          last_name: p.last_name || p.lastName || '',
          email: p.email,
          job_title: p.job_title || p.jobTitle || p.title || '',
          company: p.company || p.organization || '',
          industry: p.industry || form.industry,
          seniority: p.seniority || '',
          country: form.country,
        });
        const res = await api.addToCampaign(saved.id, Number(selectedCampaign));
        if (res.ai_error) aiWarning = res.ai_error;
        added++;
      } catch (err) {
        console.error(err);
      }
    }

    setAdding(false);
    setSuccess(`Added ${added} prospect${added !== 1 ? 's' : ''} to campaign.${aiWarning ? ' Note: ' + aiWarning : ''}`);
    setSelected(new Set());
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Prospect Search</h1>
        <p className="text-gray-500 text-sm mt-0.5">Find prospects via the Prospeo API</p>
      </div>

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
              {loading ? '🔍 Searching…' : '🔍 Search Prospects'}
            </button>
          </div>
        </form>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="btn-secondary text-xs">
                {selected.size === results.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-sm text-gray-500">{results.length} prospects found</span>
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-3">
                <select className="input !w-auto" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                  <option value="">Select campaign…</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn-primary" onClick={addToCampaign} disabled={adding}>
                  {adding ? 'Adding…' : `Add ${selected.size} to Campaign`}
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
                      {p.first_name || p.firstName || ''} {p.last_name || p.lastName || ''}
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
