import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function InterviewerLogin() {
  const { user, saveLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (user) return <Navigate to="/interviewer/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, interviewer } = await login(email, password);
      saveLogin(token, interviewer);
      navigate('/interviewer/dashboard');
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
          <div className="icon">🕊️</div>
          <h1>Interviewer Portal</h1>
          <p>Water Baptism Registry</p>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="yourname@church.org"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            style={{ width: '100%', marginTop: '.5rem' }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <p className="text-muted text-center mt-2">
          <a href="/">← Back to Registration Form</a>
        </p>
      </div>
    </div>
  );
}
