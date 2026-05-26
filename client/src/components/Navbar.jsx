import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/interviewer/login');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar__brand">
        <span className="icon">🕊️</span>
        Water Baptism Registry
      </Link>

      <div className="navbar__links">
        {user ? (
          <>
            <Link to="/interviewer/dashboard" className="navbar__link">Dashboard</Link>
            {user.role === 'admin' && (
              <Link to="/interviewer/manage" className="navbar__link">Interviewers</Link>
            )}
            <span className="navbar__link" style={{ opacity: .6 }}>
              {user.name}
            </span>
            <button className="navbar__btn" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <Link to="/interviewer/login" className="navbar__link">Interviewer Login</Link>
        )}
      </div>
    </nav>
  );
}
