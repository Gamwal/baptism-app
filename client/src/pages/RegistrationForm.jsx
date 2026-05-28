import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCandidate } from '../services/api';

const STEPS = ['Personal', 'Church', 'Spiritual', 'Guardian', 'Review'];

const INITIAL = {
  // Personal
  fullName: '', gender: '', dateOfBirth: '', age: '',
  maritalStatus: '', residentialAddress: '', phoneNumber: '',
  email: '', occupation: '', nationality: '', stateOfOrigin: '',
  // Church
  branchChurch: '', zone: '', area: '', groupPastorName: '',
  // Spiritual
  salvationExperience: '', sanctificationExperience: '', holyGhostBaptism: '',
  previouslyBaptized: false,
  prevChurchName: '', prevModeOfBaptism: '', prevBaptismDate: '',
  // Guardian
  isMinor: false,
  guardianName: '', guardianPhone: '', guardianConsent: false, guardianSignature: '',
};

function StepIndicator({ current }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const num = i + 1;
        const cls = num < current ? 'step step--done'
                  : num === current ? 'step step--active'
                  : 'step';
        return (
          <div key={label} className={cls}>
            <div className="step__circle">
              {num < current ? '✓' : num}
            </div>
            <div className="step__label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, hint, error, children }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span className="required"> *</span>}
      </label>
      {children}
      {hint  && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export default function RegistrationForm() {
  const navigate = useNavigate();
  const [step, setStep]       = useState(1);
  const [data, setData]       = useState(INITIAL);
  const [errors, setErrors]   = useState({});
  const [submitting, setSub]  = useState(false);
  const [submitError, setSubError] = useState('');

  function set(field, value) {
    setData(d => ({ ...d, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
  }

  function inp(field) {
    return {
      className: `form-input${errors[field] ? ' error' : ''}`,
      value: data[field],
      onChange: e => set(field, e.target.value),
    };
  }

  function sel(field) {
    return {
      className: `form-select${errors[field] ? ' error' : ''}`,
      value: data[field],
      onChange: e => set(field, e.target.value),
    };
  }

  function validate(s) {
    const e = {};
    if (s === 1) {
      if (!data.fullName.trim())         e.fullName = 'Full name is required';
      if (!data.gender)                  e.gender = 'Please select a gender';
      if (!data.maritalStatus)           e.maritalStatus = 'Please select marital status';
      if (!data.residentialAddress.trim()) e.residentialAddress = 'Address is required';
      if (!data.phoneNumber.trim())      e.phoneNumber = 'Phone number is required';
    }
    if (s === 2) {
      if (!data.branchChurch.trim()) e.branchChurch = 'Branch church is required';
    }
    if (s === 4 && data.isMinor) {
      if (!data.guardianName.trim())  e.guardianName = 'Guardian name is required';
      if (!data.guardianPhone.trim()) e.guardianPhone = 'Guardian phone is required';
      if (!data.guardianConsent)      e.guardianConsent = 'Guardian consent is required';
    }
    return e;
  }

  function next() {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  }

  function back() {
    setStep(s => s - 1);
    window.scrollTo(0, 0);
  }

  async function submit() {
    setSub(true);
    setSubError('');
    try {
      const result = await registerCandidate(data);
      navigate('/success', { state: result });
    } catch (err) {
      setSubError(err.message);
      setSub(false);
    }
  }

  return (
    <>
      <div className="page-hero">
        <h1 className="page-hero__title">Water Baptism Registration</h1>
        <p className="page-hero__sub">Fill in the form below to register for water baptism. You will receive an interview date and tracking number.</p>
      </div>

      <main className="form-page">
        <div className="container">
          <StepIndicator current={step} />

          <div className="card">
            {step === 1 && <Step1 data={data} set={set} inp={inp} sel={sel} errors={errors} />}
            {step === 2 && <Step2 data={data} set={set} inp={inp} errors={errors} />}
            {step === 3 && <Step3 data={data} set={set} inp={inp} errors={errors} />}
            {step === 4 && <Step4 data={data} set={set} inp={inp} errors={errors} />}
            {step === 5 && <ReviewStep data={data} />}

            {submitError && (
              <div className="alert alert--error mt-2">{submitError}</div>
            )}

            <div className="btn-row">
              {step > 1
                ? <button className="btn btn--secondary" onClick={back}>← Back</button>
                : <span />
              }
              {step < 5
                ? <button className="btn btn--primary" onClick={next}>Continue →</button>
                : <button className="btn btn--success btn--lg" onClick={submit} disabled={submitting}>
                    {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit Registration'}
                  </button>
              }
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* ── Step 1: Personal Information ─────────────────────────────────────────── */
function Step1({ data, set, inp, sel, errors }) {
  return (
    <>
      <h2 className="section-title">Personal Information</h2>
      <div className="form-grid">
        <Field label="Full Name" required error={errors.fullName}>
          <input {...inp('fullName')} placeholder="e.g. Adebayo Emmanuel Osei" />
        </Field>

        <Field label="Gender" required error={errors.gender}>
          <div className="radio-group" style={{ marginTop: '.25rem' }}>
            {['Male', 'Female'].map(g => (
              <label key={g} className="radio-option">
                <input type="radio" name="gender" value={g}
                  checked={data.gender === g}
                  onChange={() => set('gender', g)} />
                {g}
              </label>
            ))}
          </div>
          {errors.gender && <span className="form-error">{errors.gender}</span>}
        </Field>

        <Field label="Date of Birth" hint="Or fill in Age below">
          <input type="date" {...inp('dateOfBirth')} />
        </Field>

        <Field label="Age" hint="Fill if Date of Birth is unknown">
          <input {...inp('age')} placeholder="e.g. 25" />
        </Field>

        <Field label="Marital Status" required error={errors.maritalStatus}>
          <select {...sel('maritalStatus')}>
            <option value="">— Select —</option>
            {['Single', 'Married', 'Divorced', 'Widowed'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Phone Number" required error={errors.phoneNumber}>
          <input {...inp('phoneNumber')} placeholder="+234 800 000 0000" />
        </Field>

        <Field label="Residential Address" required error={errors.residentialAddress} >
          <input {...inp('residentialAddress')} placeholder="Street, City, State" className={`form-input${errors.residentialAddress ? ' error' : ''}`} />
        </Field>

        <Field label="Email Address" hint="Optional">
          <input type="email" {...inp('email')} placeholder="you@example.com" />
        </Field>

        <Field label="Occupation / Profession">
          <input {...inp('occupation')} placeholder="e.g. Teacher, Engineer, Student" />
        </Field>

        <Field label="Nationality">
          <input {...inp('nationality')} placeholder="e.g. Nigerian" />
        </Field>

        <Field label="State of Origin">
          <input {...inp('stateOfOrigin')} placeholder="e.g. Lagos, Kano" />
        </Field>
      </div>
    </>
  );
}

/* ── Step 2: Church Information ───────────────────────────────────────────── */
function Step2({ data, inp, errors }) {
  return (
    <>
      <h2 className="section-title">Church Information</h2>
      <div className="form-grid">
        <Field label="Branch Church" required error={errors.branchChurch}>
          <input {...inp('branchChurch')} placeholder="e.g. Apostolic Faith Anthony" />
        </Field>

        <Field label="Zone">
          <input {...inp('zone')} placeholder="e.g. Lagos Zone A" />
        </Field>

        <Field label="Area">
          <input {...inp('area')} placeholder="e.g. Surulere Area" />
        </Field>

        <Field label="Group / Pastor's Name">
          <input {...inp('groupPastorName')} placeholder="e.g. Brother Oluwafemi Adeyemi" />
        </Field>
      </div>
    </>
  );
}

/* ── Step 3: Spiritual Experiences ───────────────────────────────────────── */
function Step3({ data, set, inp, errors }) {
  return (
    <>
      <h2 className="section-title">Spiritual Experiences</h2>
      <div className="form-grid">
        <Field label="Salvation Experience"
          hint="Briefly describe how and when you gave your life to Christ"
          error={errors.salvationExperience}>
          <div className="form-group--full">
            <textarea {...inp('salvationExperience')}
              className="form-textarea"
              placeholder="e.g. I gave my life to Christ in 2018 at a crusade…" />
          </div>
        </Field>

        <Field label="Sanctification Experience"
          hint="Have you experienced sanctification? Describe briefly">
          <div className="form-group--full">
            <textarea {...inp('sanctificationExperience')}
              className="form-textarea"
              placeholder="Describe your sanctification experience, if applicable…" />
          </div>
        </Field>

        <Field label="Baptism of the Holy Ghost"
          hint="Have you received the baptism of the Holy Ghost? Describe briefly">
          <div className="form-group--full">
            <textarea {...inp('holyGhostBaptism')}
              className="form-textarea"
              placeholder="Describe your Holy Ghost baptism experience, if applicable…" />
          </div>
        </Field>
      </div>

      <hr className="divider" />
      <h2 className="section-title" style={{ marginTop: '1rem' }}>Previous Baptism</h2>

      <label className="checkbox-option" style={{ marginBottom: '.75rem' }}>
        <input type="checkbox" checked={data.previouslyBaptized}
          onChange={e => set('previouslyBaptized', e.target.checked)} />
        I have been baptized before
      </label>

      {data.previouslyBaptized && (
        <div className="conditional-section">
          <div className="form-grid">
            <Field label="Name of Church">
              <input {...inp('prevChurchName')} placeholder="Church where you were baptized" />
            </Field>

            <Field label="Mode of Baptism">
              <select className="form-select" value={data.prevModeOfBaptism}
                onChange={e => set('prevModeOfBaptism', e.target.value)}>
                <option value="">— Select mode —</option>
                {['Immersion', 'Sprinkling', 'Pouring', 'Other'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>

            <Field label="Date of Baptism">
              <input type="date" {...inp('prevBaptismDate')} />
            </Field>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Step 4: Parent / Guardian ────────────────────────────────────────────── */
function Step4({ data, set, inp, errors }) {
  return (
    <>
      <h2 className="section-title">Parent / Guardian Information</h2>
      <p className="text-muted" style={{ marginBottom: '1.25rem' }}>
        Complete this section if the candidate is under 18 years of age.
      </p>

      <label className="checkbox-option" style={{ marginBottom: '1rem' }}>
        <input type="checkbox" checked={data.isMinor}
          onChange={e => set('isMinor', e.target.checked)} />
        This candidate is a minor (under 18 years old)
      </label>

      {data.isMinor && (
        <div className="conditional-section">
          <div className="form-grid">
            <Field label="Parent / Guardian's Name" required error={errors.guardianName}>
              <input {...inp('guardianName')} placeholder="Full name of parent or guardian" />
            </Field>

            <Field label="Parent / Guardian's Phone" required error={errors.guardianPhone}>
              <input {...inp('guardianPhone')} placeholder="+234 800 000 0000" />
            </Field>

            <Field label="Guardian's Signature" hint="Type full name as digital signature">
              <input {...inp('guardianSignature')} placeholder="Type full name to sign" />
            </Field>

            <div className="form-group">
              <label className="checkbox-option" style={{ marginTop: '1.5rem' }}>
                <input type="checkbox" checked={data.guardianConsent}
                  onChange={e => set('guardianConsent', e.target.checked)} />
                I consent to this candidate's water baptism
              </label>
              {errors.guardianConsent && (
                <span className="form-error" style={{ display: 'block', marginTop: '.3rem' }}>
                  {errors.guardianConsent}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {!data.isMinor && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--gray-400)' }}>
          No guardian information needed for adults.
          <br />
          <small>Check the box above only if the candidate is under 18.</small>
        </div>
      )}
    </>
  );
}

/* ── Step 5: Review ───────────────────────────────────────────────────────── */
function ReviewStep({ data }) {
  const fmt = v => v || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>—</span>;

  return (
    <>
      <h2 className="section-title">Review Your Information</h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Please review all details before submitting. Go back to make any corrections.
      </p>

      <ReviewSection title="Personal Information">
        <ReviewField label="Full Name"          value={fmt(data.fullName)} />
        <ReviewField label="Gender"             value={fmt(data.gender)} />
        <ReviewField label="Date of Birth"      value={fmt(data.dateOfBirth)} />
        <ReviewField label="Age"                value={fmt(data.age)} />
        <ReviewField label="Marital Status"     value={fmt(data.maritalStatus)} />
        <ReviewField label="Phone Number"       value={fmt(data.phoneNumber)} />
        <ReviewField label="Email"              value={fmt(data.email)} />
        <ReviewField label="Occupation"         value={fmt(data.occupation)} />
        <ReviewField label="Address"            value={fmt(data.residentialAddress)} />
        <ReviewField label="Nationality"        value={fmt(data.nationality)} />
        <ReviewField label="State of Origin"    value={fmt(data.stateOfOrigin)} />
      </ReviewSection>

      <ReviewSection title="Church Information">
        <ReviewField label="Branch Church"      value={fmt(data.branchChurch)} />
        <ReviewField label="Zone"               value={fmt(data.zone)} />
        <ReviewField label="Area"               value={fmt(data.area)} />
        <ReviewField label="Group / Pastor"     value={fmt(data.groupPastorName)} />
      </ReviewSection>

      <ReviewSection title="Spiritual Experiences">
        <ReviewField label="Salvation Experience"      value={fmt(data.salvationExperience)} full />
        <ReviewField label="Sanctification Experience" value={fmt(data.sanctificationExperience)} full />
        <ReviewField label="Holy Ghost Baptism"        value={fmt(data.holyGhostBaptism)} full />
        <ReviewField label="Previously Baptized"       value={data.previouslyBaptized ? 'Yes' : 'No'} />
        {data.previouslyBaptized && <>
          <ReviewField label="Previous Church"    value={fmt(data.prevChurchName)} />
          <ReviewField label="Mode of Baptism"    value={fmt(data.prevModeOfBaptism)} />
          <ReviewField label="Date of Baptism"    value={fmt(data.prevBaptismDate)} />
        </>}
      </ReviewSection>

      {data.isMinor && (
        <ReviewSection title="Parent / Guardian">
          <ReviewField label="Guardian Name"   value={fmt(data.guardianName)} />
          <ReviewField label="Guardian Phone"  value={fmt(data.guardianPhone)} />
          <ReviewField label="Consent"         value={data.guardianConsent ? 'Given' : 'Not given'} />
          <ReviewField label="Signature"       value={fmt(data.guardianSignature)} />
        </ReviewSection>
      )}
    </>
  );
}

function ReviewSection({ title, children }) {
  return (
    <div className="review-section">
      <div className="review-section__title">{title}</div>
      <div className="review-grid">{children}</div>
    </div>
  );
}

function ReviewField({ label, value, full }) {
  return (
    <div className={`review-field${full ? ' form-group--full' : ''}`}>
      <span className="review-field__label">{label}</span>
      <span className="review-field__value">{value}</span>
    </div>
  );
}
