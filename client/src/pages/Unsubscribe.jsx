import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Unsubscribe() {
  const [list, setList] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = () => api.getSuppressionList().then(setList).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      await api.addToSuppression(newEmail.trim(), 'manual');
      setNewEmail('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove from suppression list? This contact may receive emails again.')) return;
    await api.removeFromSuppression(id);
    load();
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Suppression List</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          These contacts will never receive emails. Contacts who reply "unsubscribe" are added automatically.
        </p>
      </div>

      <div className="card p-5 mb-6">
        <form onSubmit={add} className="flex gap-3">
          <input
            className="input flex-1"
            type="email"
            placeholder="Add email to suppress…"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={adding}>
            {adding ? 'Adding…' : '+ Add Email'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-200 rounded w-2/3" />)}
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-3xl mb-3">🚫</p>
          <p>No suppressed contacts</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Reason</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">Added</th>
                <th className="px-6 py-3 text-right font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-xs text-gray-700">{item.email}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      item.reason === 'unsubscribe' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.reason}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">{new Date(item.added_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-right">
                    <button className="text-xs text-red-500 hover:text-red-700" onClick={() => remove(item.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
