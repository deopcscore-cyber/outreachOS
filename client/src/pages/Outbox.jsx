import { useState, useEffect } from 'react';
import { api } from '../api';

function formatDate(dt) {
  if (!dt) return 'Not scheduled';
  const d = new Date(dt);
  const now = new Date();
  const diffMs = d - now;
  const diffMins = Math.round(diffMs / 60000);
  if (diffMs < 0) return 'Due now';
  if (diffMins < 60) return `In ${diffMins}m`;
  if (diffMins < 1440) return `In ${Math.round(diffMins / 60)}h`;
  return `In ${Math.round(diffMins / 1440)}d (${d.toLocaleDateString()})`;
}

export default function Outbox() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.getOutbox()
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-sm">Loading outbox...</div>;

  const due = rows.filter(r => new Date(r.next_send_at) <= new Date());
  const scheduled = rows.filter(r => new Date(r.next_send_at) > new Date());

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Outbox</h1>
        <p className="text-gray-500 text-sm mt-0.5">Emails queued to send — review before they go out</p>
      </div>

      {rows.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          No emails queued. Add prospects to a campaign to get started.
        </div>
      )}

      {due.length > 0 && (
        <div className="mb-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          {due.length} email{due.length !== 1 ? 's are' : ' is'} due now and will go out on the next hourly send.
        </div>
      )}

      {rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Recipient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Campaign</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Scheduled</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <>
                  <tr
                    key={r.cp_id}
                    className={`hover:bg-gray-50 ${new Date(r.next_send_at) <= new Date() ? 'bg-amber-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {[r.first_name, r.last_name].filter(Boolean).join(' ') || r.prospect_email}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{r.prospect_email}</div>
                      {r.company && <div className="text-xs text-gray-400">{r.job_title} @ {r.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.campaign_name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        Email {r.current_email_index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {r.subject || <span className="text-gray-400 italic">No subject set</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(r.next_send_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(expanded === r.cp_id ? null : r.cp_id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {expanded === r.cp_id ? 'Hide' : 'Preview'}
                      </button>
                    </td>
                  </tr>
                  {expanded === r.cp_id && (
                    <tr key={`${r.cp_id}-preview`}>
                      <td colSpan={6} className="px-6 pb-4 pt-0 bg-gray-50">
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
                            <span className="font-medium">To:</span> {r.prospect_email} &nbsp;·&nbsp;
                            <span className="font-medium">Subject:</span> {r.subject || '(none)'}
                          </div>
                          <div className="px-4 py-3 bg-white text-sm text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto">
                            {r.body || <span className="text-gray-400 italic">No email body. Go to the campaign to write one.</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
