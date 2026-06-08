import { useLocation, Link } from 'react-router-dom';
import { AFC_LOGO, JESUS_MARK, CHURCH_NAME } from '../components/Logo';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Fetch a local image and turn it into a data URL so jsPDF can embed it. */
async function loadImageDataUrl(src) {
  try {
    const res  = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror   = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // missing logo shouldn't break the PDF
  }
}

async function generatePdf({ regNumber, interviewDate, interviewTime }) {
  // Lazy-load jsPDF — keeps the initial bundle small for the registration form
  const [{ jsPDF }, afcDataUrl, jesusDataUrl] = await Promise.all([
    import('jspdf'),
    loadImageDataUrl(AFC_LOGO),
    loadImageDataUrl(JESUS_MARK),
  ]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W   = 210;

  // Header band
  doc.setFillColor(30, 58, 138);  // blue-900
  doc.rect(0, 0, W, 42, 'F');

  // Africa logo on the left of the header
  if (afcDataUrl) {
    try { doc.addImage(afcDataUrl, 'PNG', 14, 7, 28, 28); } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(CHURCH_NAME, W / 2, 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Water Baptism Registration · Official Slip', W / 2, 28, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(219, 234, 254);  // soft blue
  doc.text('Africa For Christ', W / 2, 35, { align: 'center' });

  // "Jesus the Light of the World" wordmark, just below the header band
  if (jesusDataUrl) {
    try { doc.addImage(jesusDataUrl, 'PNG', (W - 90) / 2, 48, 90, 16); } catch {}
  }

  // Tracking number block
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTRATION / TRACKING NUMBER', W / 2, 76, { align: 'center' });

  doc.setDrawColor(219, 234, 254);
  doc.setLineWidth(0.6);
  doc.roundedRect(40, 80, W - 80, 22, 3, 3);
  doc.setFontSize(26);
  doc.setTextColor(30, 64, 175);
  doc.text(regNumber, W / 2, 96, { align: 'center' });

  // Interview details
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INTERVIEW DATE', 30,        120);
  doc.text('INTERVIEW TIME', W - 30,    120, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text(formatDate(interviewDate), 30,     129);
  doc.text(formatTime(interviewTime), W - 30, 129, { align: 'right' });

  // Instructions
  doc.setDrawColor(229, 231, 235);
  doc.line(20, 145, W - 20, 145);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('Important Instructions', 20, 158);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const instructions = [
    '1.  Take note of your registration number and interview time — you will need them.',
    '2.  Bring this printed slip and a valid means of identification.',
    '3.  Arrive at the church office at least 10 minutes before your interview time.',
    '4.  If you cannot make this slot, contact the church office to reschedule.',
    '5.  Dress modestly; bring a notebook and a Bible if you have one.',
  ];
  let y = 168;
  for (const line of instructions) {
    doc.text(line, 20, y, { maxWidth: W - 40 });
    y += 9;
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
    W / 2, 285, { align: 'center' }
  );

  doc.save(`baptism-registration-${regNumber}.pdf`);
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
        <img
          src={AFC_LOGO}
          alt={CHURCH_NAME}
          style={{ width: 70, height: 70, objectFit: 'contain', margin: '0 auto .25rem', display: 'block' }}
        />
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--blue-900)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          {CHURCH_NAME}
        </div>

        <div className="success-icon">✅</div>

        <h1>Registration Successful!</h1>
        <p>
          <strong>Please take careful note of your registration number and interview time below.</strong>
          {' '}You will need them on the day of your interview.
        </p>

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
          <strong>Tip:</strong> Download the printable slip below and bring it with you on
          the interview day. Your tracking number is <strong>{regNumber}</strong>.
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => generatePdf({ regNumber, interviewDate, interviewTime })}
          >
            ⬇️  Download PDF Slip
          </button>
          <Link to="/" className="btn btn--outline">Register Another Candidate</Link>
        </div>
      </div>
    </div>
  );
}
