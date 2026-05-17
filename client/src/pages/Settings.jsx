import { useEffect, useState } from 'react';
import { api } from '../api';

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({
    daily_send_limit: '30',
    send_window_start: '09:00',
    send_window_end: '17:00',
    gmail_email: '',
    gmail_password: '',
    prospeo_api_key: '',
    anthropic_api_key: '',
    ai_system_prompt: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(s => {
      setSettings(prev => ({ ...prev, ...s }));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-400 animate-pulse">Loading settings…</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configure sending, API keys, and AI behaviour</p>
      </div>

      <form onSubmit={save} className="space-y-6 max-w-2xl">

        {/* Sending */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Sending Settings</h2>
          <Field label="Daily send limit">
            <input className="input" type="number" min={1} max={500} value={settings.daily_send_limit}
              onChange={e => set('daily_send_limit', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Send window — start">
              <input className="input" type="time" value={settings.send_window_start}
                onChange={e => set('send_window_start', e.target.value)} />
            </Field>
            <Field label="Send window — end">
              <input className="input" type="time" value={settings.send_window_end}
                onChange={e => set('send_window_end', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Gmail */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Gmail SMTP</h2>
          <Field label="Gmail address" hint="The Gmail account you'll send from">
            <input className="input" type="email" value={settings.gmail_email}
              onChange={e => set('gmail_email', e.target.value)} placeholder="you@gmail.com" />
          </Field>
          <Field label="App password" hint="Generate at myaccount.google.com → Security → App passwords">
            <input className="input" type="password" value={settings.gmail_password}
              onChange={e => set('gmail_password', e.target.value)} placeholder="xxxx xxxx xxxx xxxx" />
          </Field>
        </div>

        {/* API keys */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">API Keys</h2>
          <Field label="Prospeo API key" hint="Get yours at prospeo.io → Dashboard → API">
            <input className="input" type="password" value={settings.prospeo_api_key}
              onChange={e => set('prospeo_api_key', e.target.value)} placeholder="pk_…" />
          </Field>
          <Field label="Anthropic API key" hint="Get yours at console.anthropic.com">
            <input className="input" type="password" value={settings.anthropic_api_key}
              onChange={e => set('anthropic_api_key', e.target.value)} placeholder="sk-ant-…" />
          </Field>
        </div>

        {/* AI system prompt */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">AI Email Generation</h2>
          <Field
            label="System prompt"
            hint="This controls the angle, tone, and style of AI-generated emails. Edit to change the narrative."
          >
            <textarea
              className="input min-h-[280px] resize-y font-mono text-xs leading-relaxed"
              value={settings.ai_system_prompt}
              onChange={e => set('ai_system_prompt', e.target.value)}
            />
          </Field>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary px-6" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Settings saved</span>}
        </div>
      </form>
    </div>
  );
}
