import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { api } from '../api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function pct(num, total) {
  if (!total) return '0%';
  return `${Math.round((num / total) * 100)}%`;
}

export default function Analytics() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400 animate-pulse">Loading analytics…</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Performance across all campaigns</p>
      </div>

      {data.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📈</p>
          <p>No data yet — start sending emails to see analytics.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map(campaign => {
            const { stats, bySequence } = campaign;
            const chartData = {
              labels: (bySequence || []).map(s =>
                s.sequence_index === 0 ? 'Email 1 (AI)' : `Email ${(s.sequence_index || 0) + 1}`
              ),
              datasets: [
                {
                  label: 'Sent',
                  data: (bySequence || []).map(s => s.sent),
                  backgroundColor: 'rgba(59,130,246,0.7)',
                },
                {
                  label: 'Opened',
                  data: (bySequence || []).map(s => s.opened),
                  backgroundColor: 'rgba(16,185,129,0.7)',
                },
              ],
            };

            return (
              <div key={campaign.id} className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900 text-lg">{campaign.name}</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${campaign.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {campaign.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Sent', value: stats?.total_sent || 0 },
                    { label: 'Opened', value: `${stats?.opened || 0} (${pct(stats?.opened, stats?.total_sent)})` },
                    { label: 'Bounced', value: stats?.bounced || 0 },
                    { label: 'Replied', value: `${stats?.replied || 0} (${pct(stats?.replied, stats?.total_sent)})` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {bySequence?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Open rate by email in sequence</p>
                    <div style={{ height: 200 }}>
                      <Bar
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: 'top' } },
                          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
