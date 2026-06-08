import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MIN_LEN = 6;

export default function ChangePassword() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [form, setForm]     = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');
  const [done, setDone]     = useState(false);
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
    if (apiErr) setApiErr('');
    if (done)   setDone(false);
  }

  function validate() {
    const e = {};
    if (!form.current)             e.current = 'Enter your current password';
    if (!form.next)                e.next    = 'Enter a new password';
    else if (form.next.length < MIN_LEN) e.next = `New password must be at least ${MIN_LEN} characters`;
    else if (form.next === form.current) e.next = 'New password must differ from the current one';
    if (form.confirm !== form.next) e.confirm = 'Passwords do not match';
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiErr('');
    try {
      await changePassword(form.current, form.next);
      setDone(true);
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setApiErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dashboard">
      <div className="container" style={{ maxWidth: 480 }}>
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => navigate('/interviewer/dashboard')}
        >
          ← Dashboard
        </button>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginTop: '.75rem' }}>
          Change Password
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          Signed in as <strong>{user?.email}</strong>
        </p>

        <form className="card" onSubmit={submit}>
          {done && (
            <div className="alert" style={{ background: 'var(--green-100)', color: 'var(--green-600)', marginBottom: '1rem' }}>
              ✓ Password updated successfully.
            </div>
          )}
          {apiErr && <div className="alert alert--error" style={{ marginBottom: '1rem' }}>{apiErr}</div>}

          <div className="form-group">
            <label className="form-label">Current Password <span className="required"> *</span></label>
            <input
              type="password"
              autoComplete="current-password"
              className={`form-input${errors.current ? ' error' : ''}`}
              value={form.current}
              onChange={e => set('current', e.target.value)}
              autoFocus
            />
            {errors.current && <span className="form-error">{errors.current}</span>}
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">New Password <span className="required"> *</span></label>
            <input
              type="password"
              autoComplete="new-password"
              className={`form-input${errors.next ? ' error' : ''}`}
              value={form.next}
              onChange={e => set('next', e.target.value)}
            />
            <span className="form-hint">At least {MIN_LEN} characters.</span>
            {errors.next && <span className="form-error">{errors.next}</span>}
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Confirm New Password <span className="required"> *</span></label>
            <input
              type="password"
              autoComplete="new-password"
              className={`form-input${errors.confirm ? ' error' : ''}`}
              value={form.confirm}
              onChange={e => set('confirm', e.target.value)}
            />
            {errors.confirm && <span className="form-error">{errors.confirm}</span>}
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Updating…</> : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
