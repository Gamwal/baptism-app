import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getRegistrations, getStats } from '../services/api';

const STATUS_LABELS = {
  all: 'All', pending: 'Pending', scheduled: 'Scheduled',
  certified: 'Certified', declined: 'Declined',
};

function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{status}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function InterviewerDashboard() {
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats]   = useState(null);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [regData, statsData] = await Promise.all([
        getRegistrations({ search: search || undefined, status: status === 'all' ? undefined : status, page, limit: LIMIT }),
        getStats(),
      ]);
      setRegistrations(regData.registrations);
      setTotal(regData.total);
      setStats(statsData.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, status]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <main className="dashboard">
      <div className="container container--wide">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--gray-900)' }}>
          Baptism Candidates Dashboard
        </h1>

        {/* Stats */}
        {stats && (
          <div className="stats-grid">
            <StatCard label="Total Registered" value={stats.total}     cls="total" />
            <StatCard label="Pending"           value={stats.pending}   cls="pending" />
            <StatCard label="Scheduled"         value={stats.scheduled} cls="scheduled" />
            <StatCard label="Certified"         value={stats.certified} cls="certified" />
            <StatCard label="Declined"          value={stats.declined}  cls="declined" />
          </div>
        )}

        {/* Toolbar */}
        <div className="table-toolbar">
          <input
            className="search-input"
            placeholder="Search by name, reg number, or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
          <button className="btn btn--secondary btn--sm" onClick={load}>Refresh</button>
        </div>

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><p>Loading…</p></div>
          ) : registrations.length === 0 ? (
            <div className="empty-state"><p>No candidates found.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Reg Number</th>
                  <th>Full Name</th>
                  <th>Phone</th>
                  <th>Branch Church</th>
                  <th>Interview Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(r => (
                  <tr key={r.id}>
                    <td><span className="td-reg">{r.reg_number}</span></td>
                    <td><span className="td-name">{r.full_name}</span></td>
                    <td>{r.phone_number}</td>
                    <td>{r.branch_church}</td>
                    <td>{formatDate(r.interview_date)}</td>
                    <td>{formatTime(r.interview_time)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <Link
                        to={`/interviewer/candidate/${r.id}`}
                        className="btn btn--outline btn--sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {total > LIMIT && (
            <div className="pagination">
              <span>Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
              <div className="pagination__btns">
                <button
                  className="pagination__btn"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >← Prev</button>
                <button
                  className="pagination__btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, cls }) {
  return (
    <div className={`stat-card stat-card--${cls}`}>
      <div className="stat-card__value">{value ?? '—'}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  );
}
