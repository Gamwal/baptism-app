import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRegistration, addComment, certifyCandidate, declineCandidate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`} style={{ fontSize: '.85rem', padding: '.3rem .85rem' }}>{status}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit' });
}

function InfoField({ label, value }) {
  const display = value
    ? <span className="info-field__value">{value}</span>
    : <span className="info-field__value info-field__value--empty">Not provided</span>;
  return (
    <div className="info-field">
      <span className="info-field__label">{label}</span>
      {display}
    </div>
  );
}

function ExperienceView({ label, date, text }) {
  // The experience was indicated if it has either a date or a description
  if (!date && !text) {
    return (
      <div>
        <div className="info-field__label">{label}</div>
        <div className="info-field__value info-field__value--empty">Not indicated</div>
      </div>
    );
  }
  return (
    <div>
      <div className="info-field__label">
        {label}{date ? ` — ${date}` : ''}
      </div>
      <div className="info-field__value" style={{ whiteSpace: 'pre-wrap' }}>
        {text || <span className="info-field__value--empty">No description provided</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card card--sm" style={{ marginBottom: '1rem' }}>
      <h3 className="section-title">{title}</h3>
      <div className="info-grid">{children}</div>
    </div>
  );
}

export default function CandidateDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [registration, setRegistration] = useState(null);
  const [comments, setComments]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [commentText, setCommentText]   = useState('');
  const [actionComment, setActionComment] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [actionError, setActionError]   = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // 'certify' | 'decline'

  async function loadData() {
    try {
      const data = await getRegistration(id);
      setRegistration(data.registration);
      setComments(data.comments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [id]);

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await addComment(id, commentText.trim());
      setCommentText('');
      await loadData();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(action) {
    setSubmitting(true);
    setActionError('');
    try {
      if (action === 'certify') {
        await certifyCandidate(id, actionComment);
      } else {
        await declineCandidate(id, actionComment);
      }
      setConfirmAction(null);
      setActionComment('');
      await loadData();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="loading-page">Loading candidate…</div>;
  if (!registration) return (
    <div className="loading-page">
      Candidate not found. <button className="btn btn--secondary btn--sm" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  );

  const r = registration;
  const isClosed = r.status === 'certified' || r.status === 'declined';

  return (
    <main className="detail-page">
      <div className="container container--wide">
        {/* Header */}
        <div className="detail-header">
          <div className="detail-header__left">
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => navigate(-1)}
              style={{ marginBottom: '.75rem' }}
            >
              ← Back
            </button>
            <h1>{r.full_name}</h1>
            <div className="reg-num">{r.reg_number}</div>
            <div style={{ marginTop: '.5rem' }}>
              <StatusBadge status={r.status} />
              {r.interviewer_name && (
                <span style={{ marginLeft: '.75rem', fontSize: '.82rem', color: 'var(--gray-500)' }}>
                  Reviewed by {r.interviewer_name}
                </span>
              )}
            </div>
          </div>

          {!isClosed && (
            <div className="detail-actions">
              <button
                className="btn btn--success"
                onClick={() => { setConfirmAction('certify'); setActionError(''); }}
              >
                Certify for Baptism
              </button>
              <button
                className="btn btn--danger"
                onClick={() => { setConfirmAction('decline'); setActionError(''); }}
              >
                Decline
              </button>
            </div>
          )}
        </div>

        {/* Confirm action modal-like inline */}
        {confirmAction && (
          <div className="card" style={{ marginBottom: '1rem', border: `2px solid ${confirmAction === 'certify' ? 'var(--green-600)' : 'var(--red-600)'}` }}>
            <h3 style={{ marginBottom: '.75rem', color: confirmAction === 'certify' ? 'var(--green-600)' : 'var(--red-600)' }}>
              {confirmAction === 'certify' ? 'Certify this candidate for water baptism?' : 'Decline this candidate?'}
            </h3>
            <div className="form-group">
              <label className="form-label">Final comment (optional)</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder="Add a closing note…"
              />
            </div>
            {actionError && <div className="alert alert--error mt-1">{actionError}</div>}
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem' }}>
              <button
                className={`btn ${confirmAction === 'certify' ? 'btn--success' : 'btn--danger'}`}
                onClick={() => handleAction(confirmAction)}
                disabled={submitting}
              >
                {submitting ? <><span className="spinner" /> Processing…</> : `Confirm ${confirmAction === 'certify' ? 'Certification' : 'Decline'}`}
              </button>
              <button className="btn btn--secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Interview slot */}
        <div className="card card--sm" style={{ marginBottom: '1rem', background: 'var(--blue-50)', border: '1px solid var(--blue-100)' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <div className="info-field__label">Interview Date</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue-900)' }}>
                {formatDate(r.interview_date)}
              </div>
            </div>
            <div>
              <div className="info-field__label">Interview Time</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue-900)' }}>
                {formatTime(r.interview_time)}
              </div>
            </div>
            <div>
              <div className="info-field__label">Registered On</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-700)' }}>
                {formatDateTime(r.created_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <Section title="Personal Information">
          <InfoField label="Full Name"          value={r.full_name} />
          <InfoField label="Gender"             value={r.gender} />
          <InfoField label="Date of Birth"      value={r.date_of_birth} />
          <InfoField label="Age"                value={r.age} />
          <InfoField label="Marital Status"     value={r.marital_status} />
          <InfoField label="Phone Number"       value={r.phone_number} />
          <InfoField label="Email"              value={r.email} />
          <InfoField label="Occupation"         value={r.occupation} />
          <InfoField label="Nationality"        value={r.nationality} />
          <InfoField label="State of Origin"    value={r.state_of_origin} />
          <InfoField label="Residential Address" value={r.residential_address} />
        </Section>

        {/* Church Information */}
        <Section title="Church Information">
          <InfoField label="Branch Church"      value={r.branch_church} />
          <InfoField label="Zone"               value={r.zone} />
          <InfoField label="Area"               value={r.area} />
          <InfoField label="Group / Pastor"     value={r.group_pastor_name} />
        </Section>

        {/* Spiritual Experiences */}
        <div className="card card--sm" style={{ marginBottom: '1rem' }}>
          <h3 className="section-title">Spiritual Experiences</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ExperienceView label="Salvation Experience"      date={r.salvation_date}      text={r.salvation_experience} />
            <ExperienceView label="Sanctification Experience" date={r.sanctification_date} text={r.sanctification_experience} />
            <ExperienceView label="Baptism of the Holy Ghost" date={r.holy_ghost_date}     text={r.holy_ghost_baptism} />
          </div>
        </div>

        {/* Previous Baptism */}
        <Section title="Previous Baptism">
          <InfoField label="Previously Baptized"   value={r.previously_baptized ? 'Yes' : 'No'} />
          {r.previously_baptized ? <>
            <InfoField label="Previous Church"     value={r.prev_church_name} />
            <InfoField label="Mode of Baptism"     value={r.prev_mode_of_baptism} />
            <InfoField label="Date of Baptism"     value={r.prev_baptism_date} />
          </> : null}
        </Section>

        {/* Guardian */}
        {r.is_minor ? (
          <Section title="Parent / Guardian">
            <InfoField label="Guardian Name"    value={r.guardian_name} />
            <InfoField label="Guardian Phone"   value={r.guardian_phone} />
            <InfoField label="Consent Given"    value={r.guardian_consent ? 'Yes' : 'No'} />
            <InfoField label="Signature"        value={r.guardian_signature} />
          </Section>
        ) : null}

        {/* Comments */}
        <div className="card card--sm">
          <h3 className="section-title">Interview Comments</h3>

          {comments.length === 0 ? (
            <p className="text-muted" style={{ marginBottom: '1rem' }}>No comments yet.</p>
          ) : (
            <div className="comment-list">
              {comments.map(c => (
                <div key={c.id} className="comment-item">
                  <div className="comment-item__meta">
                    <span className="comment-item__author">{c.interviewer_name}</span>
                    <span className="comment-item__date">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="comment-item__text">{c.comment}</p>
                </div>
              ))}
            </div>
          )}

          {!isClosed && (
            <form className="comment-form" onSubmit={handleAddComment}>
              <textarea
                className="form-textarea"
                rows={3}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add an interview note or observation…"
              />
              {actionError && !confirmAction && (
                <div className="alert alert--error">{actionError}</div>
              )}
              <div>
                <button
                  type="submit"
                  className="btn btn--primary btn--sm"
                  disabled={submitting || !commentText.trim()}
                >
                  {submitting ? <><span className="spinner" /> Saving…</> : 'Add Comment'}
                </button>
              </div>
            </form>
          )}

          {isClosed && (
            <p className="text-muted">
              This registration is {r.status}. No further comments can be added.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
