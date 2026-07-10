import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCandidate, getAreas, getZones, getBranches } from '../services/api';
import { AFC_LOGO, JESUS_MARK, CHURCH_NAME } from '../components/Logo';
import { todayLocalDateStr } from '../utils/format';

const STEPS = ['Personal', 'Church', 'Spiritual', 'Guardian', 'Review'];

const MINOR_AGE = 18;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Phone is valid if it has 7–15 digits and only digits, spaces, +, -, (, ) characters. */
function isValidPhone(phone) {
  if (!/^[\d\s+()-]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** Calculate whole-year age from a YYYY-MM-DD date string. Returns null if invalid/empty. */
function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

const INITIAL = {
  // Personal
  fullName: '', gender: '', dateOfBirth: '',
  maritalStatus: '', residentialAddress: '', phoneNumber: '',
  email: '', occupation: '', nationality: '', stateOfOrigin: '',
  // Church — names come from AFM directory; ids kept so we can link back
  area: '', areaId: '',
  zone: '', zoneId: '',
  branchChurch: '', branchChurchId: '',
  groupPastorName: '',
  // Spiritual — each experience has its own checkbox, date and description
  hasSalvation: false,      salvationDate: '',      salvationExperience: '',
  hasSanctification: false, sanctificationDate: '', sanctificationExperience: '',
  hasHolyGhost: false,      holyGhostDate: '',      holyGhostBaptism: '',
  previouslyBaptized: false,
  prevChurchName: '', prevModeOfBaptism: '', prevBaptismDate: '',
  // Guardian (auto-enabled when the candidate is a minor)
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

  // Derived from date of birth — never edited directly
  const age     = calcAge(data.dateOfBirth);
  const isMinor = age != null && age < MINOR_AGE;

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
      if (!data.dateOfBirth)             e.dateOfBirth = 'Date of birth is required';
      else if (age == null)              e.dateOfBirth = 'Please enter a valid date of birth';
      if (!data.maritalStatus)           e.maritalStatus = 'Please select marital status';
      if (!data.residentialAddress.trim()) e.residentialAddress = 'Address is required';
      if (!data.phoneNumber.trim())      e.phoneNumber = 'Phone number is required';
      else if (!isValidPhone(data.phoneNumber.trim())) e.phoneNumber = 'Enter a valid phone number';
      if (data.email.trim() && !EMAIL_RE.test(data.email.trim())) e.email = 'Enter a valid email address';
    }
    if (s === 2) {
      if (!data.areaId)             e.area         = 'Please select an area';
      if (!data.zoneId)             e.zone         = 'Please select a zone';
      if (!data.branchChurchId)     e.branchChurch = 'Please select a branch church';
    }
    if (s === 3) {
      // When an experience is checked its date is required; the description is optional
      if (data.hasSalvation      && !data.salvationDate)      e.salvationDate = 'Please provide the date';
      if (data.hasSanctification && !data.sanctificationDate) e.sanctificationDate = 'Please provide the date';
      if (data.hasHolyGhost      && !data.holyGhostDate)      e.holyGhostDate = 'Please provide the date';
      // Experiences must be chronological: Salvation → Sanctification → Holy Ghost
      const ordered = [
        data.hasSalvation      && data.salvationDate      ? { k: 'salvationDate',      d: data.salvationDate }      : null,
        data.hasSanctification && data.sanctificationDate ? { k: 'sanctificationDate', d: data.sanctificationDate } : null,
        data.hasHolyGhost      && data.holyGhostDate      ? { k: 'holyGhostDate',      d: data.holyGhostDate }      : null,
      ].filter(Boolean);
      for (let i = 1; i < ordered.length; i++) {
        if (ordered[i].d < ordered[i - 1].d) {
          e[ordered[i].k] = 'Dates must follow the order: Salvation → Sanctification → Holy Ghost Baptism';
        }
      }
    }
    if (s === 4 && isMinor) {
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
      const payload = {
        ...data,
        age: age != null ? String(age) : '',
        isMinor,
      };
      const result = await registerCandidate(payload);
      navigate('/success', { state: result });
    } catch (err) {
      setSubError(err.message);
      setSub(false);
    }
  }

  return (
    <>
      <div className="page-hero">
        <img
          src={AFC_LOGO}
          alt="Apostolic Faith Church"
          style={{ width: 92, height: 92, objectFit: 'contain', margin: '0 auto .75rem', display: 'block', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.25))' }}
        />
        <div style={{ fontSize: '.95rem', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', opacity: .85, marginBottom: '.2rem' }}>
          {CHURCH_NAME}
        </div>
        <h1 className="page-hero__title">Water Baptism Registration</h1>
        <p className="page-hero__sub">Fill in the form below to register for water baptism. You will receive an interview date and tracking number.</p>
        <img
          src={JESUS_MARK}
          alt="Jesus the Light of the World"
          style={{ height: 38, marginTop: '.9rem', filter: 'brightness(1.05) drop-shadow(0 1px 2px rgba(0,0,0,.4))' }}
        />
      </div>

      <main className="form-page">
        <div className="container">
          <StepIndicator current={step} />

          <div className="card">
            {step === 1 && <Step1 data={data} set={set} inp={inp} sel={sel} errors={errors} age={age} />}
            {step === 2 && <Step2 data={data} set={set} inp={inp} errors={errors} />}
            {step === 3 && <Step3 data={data} set={set} inp={inp} errors={errors} />}
            {step === 4 && <Step4 data={data} set={set} inp={inp} errors={errors} isMinor={isMinor} age={age} />}
            {step === 5 && <ReviewStep data={data} age={age} isMinor={isMinor} />}

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
function Step1({ data, set, inp, sel, errors, age }) {
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

        <Field label="Date of Birth" required error={errors.dateOfBirth}
          hint="Used to calculate age">
          <input type="date" max={todayLocalDateStr()} {...inp('dateOfBirth')} />
        </Field>

        <Field label="Age" hint="Calculated automatically from date of birth">
          <input
            className="form-input"
            value={age != null ? `${age} year${age === 1 ? '' : 's'}` : ''}
            placeholder="—"
            readOnly
            disabled
            style={{ background: 'var(--gray-100)', cursor: 'not-allowed' }}
          />
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

        <Field label="Email Address" hint="Optional" error={errors.email}>
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
function Step2({ data, set, inp, errors }) {
  const [areas,    setAreas]    = useState([]);
  const [zones,    setZones]    = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading,  setLoading]  = useState({ areas: false, zones: false, branches: false });
  const [loadErr,  setLoadErr]  = useState('');

  // Areas: load once
  useEffect(() => {
    setLoading(l => ({ ...l, areas: true }));
    getAreas()
      .then(({ areas }) => setAreas(areas))
      .catch(err => setLoadErr(`Couldn't load areas: ${err.message}`))
      .finally(() => setLoading(l => ({ ...l, areas: false })));
  }, []);

  // Zones: reload whenever area changes
  useEffect(() => {
    if (!data.areaId) { setZones([]); return; }
    setLoading(l => ({ ...l, zones: true }));
    getZones(data.areaId)
      .then(({ zones }) => setZones(zones))
      .catch(err => setLoadErr(`Couldn't load zones: ${err.message}`))
      .finally(() => setLoading(l => ({ ...l, zones: false })));
  }, [data.areaId]);

  // Branches: reload whenever zone changes
  useEffect(() => {
    if (!data.zoneId) { setBranches([]); return; }
    setLoading(l => ({ ...l, branches: true }));
    getBranches(data.zoneId, data.areaId)
      .then(({ branches }) => setBranches(branches))
      .catch(err => setLoadErr(`Couldn't load branches: ${err.message}`))
      .finally(() => setLoading(l => ({ ...l, branches: false })));
  }, [data.zoneId, data.areaId]);

  function pickArea(e) {
    const id = e.target.value;
    const a  = areas.find(x => x.id === id);
    set('areaId', id);
    set('area',   a?.name || '');
    // Clear downstream selections so user can't keep a stale zone/branch
    set('zoneId', ''); set('zone', '');
    set('branchChurchId', ''); set('branchChurch', '');
  }

  function pickZone(e) {
    const id = e.target.value;
    const z  = zones.find(x => x.id === id);
    set('zoneId', id);
    set('zone',   z?.name || '');
    set('branchChurchId', ''); set('branchChurch', '');
  }

  function pickBranch(e) {
    const id = e.target.value;
    const b  = branches.find(x => x.id === id);
    set('branchChurchId', id);
    set('branchChurch',   b?.name || '');
  }

  return (
    <>
      <h2 className="section-title">Church Information</h2>

      {loadErr && <div className="alert alert--error" style={{ marginBottom: '1rem' }}>{loadErr}</div>}

      <div className="form-grid">
        <Field label="Area" required error={errors.area}>
          <select
            className={`form-select${errors.area ? ' error' : ''}`}
            value={data.areaId}
            onChange={pickArea}
            disabled={loading.areas}
          >
            <option value="">
              {loading.areas ? 'Loading areas…' : '— Select area —'}
            </option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>

        <Field label="Zone" required error={errors.zone}>
          <select
            className={`form-select${errors.zone ? ' error' : ''}`}
            value={data.zoneId}
            onChange={pickZone}
            disabled={!data.areaId || loading.zones}
          >
            <option value="">
              {!data.areaId    ? 'Select an area first'
               : loading.zones ? 'Loading zones…'
               : zones.length === 0 ? 'No zones available'
               : '— Select zone —'}
            </option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </Field>

        <Field label="Branch Church" required error={errors.branchChurch}>
          <select
            className={`form-select${errors.branchChurch ? ' error' : ''}`}
            value={data.branchChurchId}
            onChange={pickBranch}
            disabled={!data.zoneId || loading.branches}
          >
            <option value="">
              {!data.zoneId       ? 'Select a zone first'
               : loading.branches ? 'Loading branches…'
               : branches.length === 0 ? 'No branches available'
               : '— Select branch —'}
            </option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>

        <Field label="Group / Pastor's Name">
          <input {...inp('groupPastorName')} placeholder="e.g. Brother Oluwafemi Adeyemi" />
        </Field>
      </div>
    </>
  );
}

/* ── Step 3: Spiritual Experiences ───────────────────────────────────────── */
function ExperienceBlock({ data, set, errors, flagKey, dateKey, descKey, title, placeholder }) {
  const checked = data[flagKey];

  function toggle(isOn) {
    set(flagKey, isOn);
    if (!isOn) { set(dateKey, ''); set(descKey, ''); } // clear when unchecked
  }

  const today = todayLocalDateStr();

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label className="checkbox-option" style={{ marginBottom: checked ? '.75rem' : 0 }}>
        <input type="checkbox" checked={checked} onChange={e => toggle(e.target.checked)} />
        I have experienced {title}
      </label>

      {checked && (
        <div className="conditional-section">
          <Field label="Date of Experience" required error={errors[dateKey]}>
            <input
              type="date"
              max={today}
              className={`form-input${errors[dateKey] ? ' error' : ''}`}
              value={data[dateKey]}
              onChange={e => set(dateKey, e.target.value)}
            />
          </Field>

          <div className="form-group" style={{ marginTop: '.75rem' }}>
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={data[descKey]}
              onChange={e => set(descKey, e.target.value)}
              placeholder={placeholder}
            />
            <span className="form-hint">Optional</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Step3({ data, set, inp, errors }) {
  return (
    <>
      <h2 className="section-title">Spiritual Experiences</h2>
      <p className="text-muted" style={{ marginBottom: '1.25rem' }}>
        Tick each experience you have had, then provide the date and a brief description.
        Dates must be in order: Salvation first, then Sanctification, then Holy Ghost Baptism.
      </p>

      <ExperienceBlock data={data} set={set} errors={errors}
        flagKey="hasSalvation" dateKey="salvationDate" descKey="salvationExperience"
        title="Salvation"
        placeholder="e.g. I gave my life to Christ in 2018 at a crusade…" />

      <ExperienceBlock data={data} set={set} errors={errors}
        flagKey="hasSanctification" dateKey="sanctificationDate" descKey="sanctificationExperience"
        title="Sanctification"
        placeholder="Describe your sanctification experience…" />

      <ExperienceBlock data={data} set={set} errors={errors}
        flagKey="hasHolyGhost" dateKey="holyGhostDate" descKey="holyGhostBaptism"
        title="Baptism of the Holy Ghost"
        placeholder="Describe your Holy Ghost baptism experience…" />

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
function Step4({ data, set, inp, errors, isMinor, age }) {
  if (age == null) {
    return (
      <>
        <h2 className="section-title">Parent / Guardian Information</h2>
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--gray-400)' }}>
          Please enter a date of birth in Step 1 so we can determine whether guardian
          information is required.
        </div>
      </>
    );
  }

  if (!isMinor) {
    return (
      <>
        <h2 className="section-title">Parent / Guardian Information</h2>
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--gray-400)' }}>
          The candidate is {age} years old, so no guardian information is required.
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="section-title">Parent / Guardian Information</h2>
      <div className="notice" style={{ marginBottom: '1.25rem' }}>
        The candidate is <strong>{age} years old</strong> (a minor). Guardian details below
        are <strong>required</strong>.
      </div>

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
              I consent to this candidate's water baptism <span className="required"> *</span>
            </label>
            {errors.guardianConsent && (
              <span className="form-error" style={{ display: 'block', marginTop: '.3rem' }}>
                {errors.guardianConsent}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Step 5: Review ───────────────────────────────────────────────────────── */
function ReviewStep({ data, age, isMinor }) {
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
        <ReviewField label="Age"                value={age != null ? `${age} years` : fmt('')} />
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
        <ReviewField label="Salvation"
          value={data.hasSalvation ? `${data.salvationDate || '—'} · ${data.salvationExperience || ''}` : 'Not indicated'} full />
        <ReviewField label="Sanctification"
          value={data.hasSanctification ? `${data.sanctificationDate || '—'} · ${data.sanctificationExperience || ''}` : 'Not indicated'} full />
        <ReviewField label="Holy Ghost Baptism"
          value={data.hasHolyGhost ? `${data.holyGhostDate || '—'} · ${data.holyGhostBaptism || ''}` : 'Not indicated'} full />
        <ReviewField label="Previously Baptized"       value={data.previouslyBaptized ? 'Yes' : 'No'} />
        {data.previouslyBaptized && <>
          <ReviewField label="Previous Church"    value={fmt(data.prevChurchName)} />
          <ReviewField label="Mode of Baptism"    value={fmt(data.prevModeOfBaptism)} />
          <ReviewField label="Date of Baptism"    value={fmt(data.prevBaptismDate)} />
        </>}
      </ReviewSection>

      {isMinor && (
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
