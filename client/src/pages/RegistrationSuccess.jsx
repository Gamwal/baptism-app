import { useLocation, Link } from 'react-router-dom';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function RegistrationSuccess() {
  const { state } = useLocation();

  if (!state?.regNumber) {
    return (
      <div className="success-page">
        <div className="success-card">
          <h1 style={{ color: 'var(--red-600)' }}>No registration data</h1>
          <p>Please complete the registration form first.</p>
          <Link to="/" className="btn btn--primary mt-2">Go to Registration</Link>
        </div>
      </div>
    );
  }

  const { regNumber, interviewDate, interviewTime } = state;

  return (
    <div className="success-page">
      <div className="success-card">
        <div className="success-icon">✅</div>

        <h1>Registration Successful!</h1>
        <p>Your water baptism registration has been received. Please save your tracking number below.</p>

        <div className="tracking-box">
          <div className="tracking-box__label">Your Tracking Number</div>
          <div className="tracking-box__number">{regNumber}</div>
        </div>

        <div className="interview-info">
          <div className="interview-info-item">
            <div className="interview-info-item__label">Interview Date</div>
            <div className="interview-info-item__value">{formatDate(interviewDate)}</div>
          </div>
          <div className="interview-info-item">
            <div className="interview-info-item__label">Interview Time</div>
            <div className="interview-info-item__value">{formatTime(interviewTime)}</div>
          </div>
        </div>

        <div className="notice">
          <strong>Important:</strong> Please come to the church office with your tracking number
          on the interview date. Bring a valid ID and arrive 10 minutes early.
          Your tracking number is <strong>{regNumber}</strong>.
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <Link to="/" className="btn btn--outline">Register Another Candidate</Link>
        </div>
      </div>
    </div>
  );
}
