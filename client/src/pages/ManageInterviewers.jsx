import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInterviewers, createInterviewer, deleteInterviewer, resetInterviewerPassword } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDateOnly as formatDate } from '../utils/format';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'interviewer' };

export default function ManageInterviewers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [apiError, setApiError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [resetResult, setResetResult] = useState(null); // { name, tempPassword }

  // Admins only
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/interviewer/dashboard');
  }, [user, navigate]);

  async function load() {
    setLoading(true);
    try {
      const data = await getInterviewers();
      setInterviewers(data.interviewers);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())     e.name     = 'Name is required';
    if (!form.email.trim())    e.email    = 'Email is required';
    if (!form.password.trim()) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError('');
    try {
      await createInterviewer(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteInterviewer(id);
      await load();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResetPassword(id, name) {
    if (!window.confirm(`Reset ${name}'s password? Their current password will stop working immediately.`)) return;
    setResettingId(id);
    setApiError('');
    setResetResult(null);
    try {
      const { tempPassword, interviewer } = await resetInterviewerPassword(id);
      setResetResult({ name: interviewer.name, tempPassword });
    } catch (err) {
      setApiError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  return (
    <main className="dashboard">
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <button className="btn btn--secondary btn--sm" onClick={() => navigate('/interviewer/dashboard')} style={{ marginBottom: '.5rem' }}>
              ← Dashboard
            </button>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)' }}>
              Manage Interviewers
            </h1>
            <p className="text-muted">Only admins can see and manage this page.</p>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => { setShowForm(s => !s); setApiError(''); setErrors({}); }}
          >
            {showForm ? 'Cancel' : '+ Add Interviewer'}
          </button>
        </div>

        {apiError && <div className="alert alert--error" style={{ marginBottom: '1rem' }}>{apiError}</div>}

        {resetResult && (
          <div className="card card--sm" style={{ marginBottom: '1.5rem', background: 'var(--blue-50)', border: '1.5px solid var(--blue-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--blue-900)', marginBottom: '.25rem' }}>
                  New temporary password for {resetResult.name}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, color: 'var(--blue-800)', letterSpacing: '.05em' }}>
                  {resetResult.tempPassword}
                </div>
                <p className="text-muted" style={{ marginTop: '.4rem' }}>
                  Share this with them now — it will not be shown again. They should change it after logging in.
                </p>
              </div>
              <button className="btn btn--secondary btn--sm" onClick={() => setResetResult(null)}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--blue-100)' }}>
            <h2 className="section-title">New Interviewer</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name <span className="required">*</span></label>
                  <input
                    className={`form-input${errors.name ? ' error' : ''}`}
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    placeholder="e.g. Deacon Paul Eze"
                  />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address <span className="required">*</span></label>
                  <input
                    type="email"
                    className={`form-input${errors.email ? ' error' : ''}`}
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    placeholder="paul@church.org"
                  />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Password <span className="required">*</span></label>
                  <input
                    type="password"
                    className={`form-input${errors.password ? ' error' : ''}`}
                    value={form.password}
                    onChange={e => setField('password', e.target.value)}
                    placeholder="Min. 6 characters"
                  />
                  {errors.password && <span className="form-error">{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={e => setField('role', e.target.value)}
                  >
                    <option value="interviewer">Interviewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <span className="form-hint">Admins can add/remove other interviewers.</span>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Creating…</> : 'Create Interviewer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><p>Loading…</p></div>
          ) : interviewers.length === 0 ? (
            <div className="empty-state"><p>No interviewers found.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Added</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {interviewers.map(iv => (
                  <tr key={iv.id}>
                    <td className="td-name">
                      {iv.name}
                      {iv.id === user?.id && (
                        <span style={{ marginLeft: '.5rem', fontSize: '.72rem', color: 'var(--gray-400)' }}>(you)</span>
                      )}
                    </td>
                    <td>{iv.email}</td>
                    <td>
                      <span className={`badge ${iv.role === 'admin' ? 'badge--scheduled' : 'badge--pending'}`}>
                        {iv.role}
                      </span>
                    </td>
                    <td>{formatDate(iv.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn--outline btn--sm"
                          onClick={() => handleResetPassword(iv.id, iv.name)}
                          disabled={resettingId === iv.id}
                        >
                          {resettingId === iv.id ? 'Resetting…' : 'Reset Password'}
                        </button>
                        {iv.id !== user?.id ? (
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDelete(iv.id, iv.name)}
                            disabled={deletingId === iv.id}
                          >
                            {deletingId === iv.id ? 'Removing…' : 'Remove'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '.8rem', color: 'var(--gray-400)', alignSelf: 'center' }}>(you)</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
