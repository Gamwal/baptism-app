import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackRegistration } from '../services/api';
import { formatDate, formatTime } from '../utils/format';
import { AFC_LOGO, CHURCH_NAME } from '../components/Logo';

const STATUS_MESSAGES = {
  pending:   'Your registration is on file and awaiting review.',
  scheduled: 'An interviewer has begun reviewing your registration.',
  certified: 'You have been certified for water baptism. Congratulations!',
  declined:  'Your registration was not approved at this time. Please contact the church office.',
};

function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`} style={{ fontSize: '.85rem', padding: '.3rem .85rem' }}>{status}</span>;
}

export default function TrackRegistration() {
  const [regNumber, setRegNumber] = useState('');
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!regNumber.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await trackRegistration(regNumber.trim());
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo">
          <img
            src={AFC_LOGO}
            alt={CHURCH_NAME}
            style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto' }}
          />
          <h1>Track Your Registration</h1>
          <p>{CHURCH_NAME} · Water Baptism Registry</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Registration / Tracking Number</label>
            <input
              className="form-input"
              value={regNumber}
              onChange={e => setRegNumber(e.target.value)}
              placeholder="e.g. WB-2026-00012"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            style={{ width: '100%', marginTop: '.5rem' }}
            disabled={loading || !regNumber.trim()}
          >
            {loading ? <><span className="spinner" /> Looking up…</> : 'Check Status'}
          </button>
        </form>

        {error && (
          <div className="alert alert--error" style={{ marginTop: '1.25rem' }}>{error}</div>
        )}

        {result && (
          <div className="card card--sm" style={{ marginTop: '1.25rem', background: 'var(--blue-50)', border: '1px solid var(--blue-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--gray-900)' }}>{result.fullName}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '.85rem', color: 'var(--blue-800)', fontWeight: 600 }}>{result.regNumber}</div>
              </div>
              <StatusBadge status={result.status} />
            </div>

            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              {STATUS_MESSAGES[result.status] || ''}
            </p>

            <div className="interview-info" style={{ marginBottom: 0 }}>
              <div className="interview-info-item">
                <div className="interview-info-item__label">Interview Date</div>
                <div className="interview-info-item__value">{formatDate(result.interviewDate)}</div>
              </div>
              <div className="interview-info-item">
                <div className="interview-info-item__label">Interview Time</div>
                <div className="interview-info-item__value">{formatTime(result.interviewTime)}</div>
              </div>
            </div>
          </div>
        )}

        <p className="text-muted text-center mt-2">
          <Link to="/">← Back to Registration Form</Link>
        </p>
      </div>
    </div>
  );
}
