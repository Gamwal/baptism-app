import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, updateSettings } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { pad, formatHour } from '../utils/format';

const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];
const DAY_LABELS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]       = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/interviewer/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    getSettings()
      .then(({ settings }) => {
        const s = settings || { slot_minutes: 15, start_hour: 9, end_hour: 17, lead_days: 3, days_of_week: '1,2,3,4,5,6' };
        setForm({
          slotMinutes: s.slot_minutes,
          startHour:   s.start_hour,
          endHour:     s.end_hour,
          leadDays:    s.lead_days,
          daysOfWeek:  String(s.days_of_week).split(',').map(Number).filter(n => !Number.isNaN(n)),
        });
        setUpdatedAt(s.updated_at);
      })
      .catch(err => setLoadErr(err.message));
  }, []);

  function toggleDay(d) {
    setForm(f => {
      const has = f.daysOfWeek.includes(d);
      return { ...f, daysOfWeek: has ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d].sort() };
    });
  }

  async function handleSave(ev) {
    ev.preventDefault();
    setSaving(true); setSaveErr(''); setSaved(false);
    try {
      const { settings } = await updateSettings({
        slotMinutes: Number(form.slotMinutes),
        startHour:   Number(form.startHour),
        endHour:     Number(form.endHour),
        leadDays:    Number(form.leadDays),
        daysOfWeek:  form.daysOfWeek,
      });
      setUpdatedAt(settings.updated_at);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadErr) return <main className="dashboard"><div className="container"><div className="alert alert--error">{loadErr}</div></div></main>;
  if (!form)   return <div className="loading-page">Loading settings…</div>;

  const slotsPerDay = Math.max(0, Math.floor(((form.endHour - form.startHour) * 60) / form.slotMinutes));

  return (
    <main className="dashboard">
      <div className="container">
        <button className="btn btn--secondary btn--sm" onClick={() => navigate('/interviewer/dashboard')}>← Dashboard</button>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginTop: '.75rem' }}>
          Interview Slot Settings
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          New candidate registrations will be auto-assigned the next free slot using these rules.
        </p>

        <form className="card" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Slot Length</label>
              <select
                className="form-select"
                value={form.slotMinutes}
                onChange={e => setForm(f => ({ ...f, slotMinutes: Number(e.target.value) }))}
              >
                {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Lead Days</label>
              <input
                type="number" min={0} max={60}
                className="form-input"
                value={form.leadDays}
                onChange={e => setForm(f => ({ ...f, leadDays: Number(e.target.value) }))}
              />
              <span className="form-hint">Earliest a new interview can be booked, counted from today.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Start Time</label>
              <select
                className="form-select"
                value={form.startHour}
                onChange={e => setForm(f => ({ ...f, startHour: Number(e.target.value) }))}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{pad(h)}:00 ({formatHour(h)})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">End Time</label>
              <select
                className="form-select"
                value={form.endHour}
                onChange={e => setForm(f => ({ ...f, endHour: Number(e.target.value) }))}
              >
                {Array.from({ length: 24 }, (_, h) => h + 1).map(h => (
                  <option key={h} value={h}>{pad(h)}:00 ({h === 24 ? '12:00 AM' : formatHour(h)})</option>
                ))}
              </select>
              <span className="form-hint">The last slot starts at this time minus the slot length.</span>
            </div>

            <div className="form-group form-group--full">
              <label className="form-label">Days the Church Holds Interviews</label>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.4rem' }}>
                {DAY_LABELS.map((label, idx) => {
                  const on = form.daysOfWeek.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`btn ${on ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                      style={{ minWidth: 64 }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '1.25rem',
            padding: '.75rem 1rem',
            background: 'var(--blue-50)',
            border: '1px solid var(--blue-100)',
            borderRadius: 8,
            fontSize: '.9rem',
            color: 'var(--gray-700)',
          }}>
            <strong>Preview:</strong> {slotsPerDay} slots per day on {form.daysOfWeek.length}
            {' '}{form.daysOfWeek.length === 1 ? 'day' : 'days'} of the week
            {' '}({form.daysOfWeek.map(d => DAY_LABELS[d]).join(', ') || 'none'}),
            from {pad(form.startHour)}:00 to {pad(form.endHour)}:00,
            {' '}{form.slotMinutes}-minute slots, ≥{form.leadDays}-day notice.
          </div>

          {saveErr && <div className="alert alert--error" style={{ marginTop: '1rem' }}>{saveErr}</div>}
          {saved   && <div className="alert" style={{ marginTop: '1rem', background: 'var(--green-100)', color: 'var(--green-600)' }}>✓ Saved.</div>}

          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" className="btn btn--primary" disabled={saving || form.daysOfWeek.length === 0}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Save Settings'}
            </button>
            {updatedAt && (
              <span className="text-muted">
                Last updated {new Date(updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
