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

function MiniStat({ label, value, accent }) {
  return (
    <div className="rounded-xl p-4" style={{ background: accent + '12', borderLeft: `3px solid ${accent}` }}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Performance across all campaigns</p>
      </div>
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="card p-6 animate-pulse h-40" />)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Performance across all campaigns</p>
      </div>

      {data.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📈</div>
          <p className="font-semibold text-gray-700">No data yet</p>
          <p className="text-gray-400 text-sm mt-1">Start sending emails to see analytics here.</p>
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
                  backgroundColor: 'rgba(99,102,241,0.5)',
                  borderColor: 'rgba(99,102,241,0.8)',
                  borderWidth: 1,
                  borderRadius: 4,
                },
                {
                  label: 'Opened',
                  data: (bySequence || []).map(s => s.opened),
                  backgroundColor: 'rgba(16,185,129,0.5)',
                  borderColor: 'rgba(16,185,129,0.8)',
                  borderWidth: 1,
                  borderRadius: 4,
                },
              ],
            };

            return (
              <div key={campaign.id} className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900 text-lg">{campaign.name}</h2>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    campaign.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {campaign.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <MiniStat label="Total sent" value={stats?.total_sent || 0} accent="#6366f1" />
                  <MiniStat
                    label="Opened"
                    value={`${stats?.opened || 0} (${pct(stats?.opened, stats?.total_sent)})`}
                    accent="#10b981"
                  />
                  <MiniStat label="Bounced" value={stats?.bounced || 0} accent="#ef4444" />
                  <MiniStat
                    label="Replied"
                    value={`${stats?.replied || 0} (${pct(stats?.replied, stats?.total_sent)})`}
                    accent="#8b5cf6"
                  />
                </div>

                {bySequence?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Opens by email</p>
                    <div style={{ height: 180 }}>
                      <Bar
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                          },
                          scales: {
                            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f3f4f6' } },
                            x: { grid: { display: false } },
                          },
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
