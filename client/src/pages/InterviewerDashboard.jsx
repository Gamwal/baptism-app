import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getRegistrations, getStats, exportRegistrationsXlsx } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateWithDay, formatTime, todayLocalDateStr } from '../utils/format';

const STATUS_LABELS = {
  all: 'All', pending: 'Pending', scheduled: 'Scheduled',
  certified: 'Certified', declined: 'Declined',
};

function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{status}</span>;
}

function addDaysLocalStr(baseDateStr, days) {
  const d = new Date(`${baseDateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function InterviewerDashboard() {
  const { user } = useAuth();
  const [view, setView]     = useState('list'); // 'list' | 'schedule'
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats]   = useState(null);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const LIMIT = 20;

  // Schedule (day) view state
  const [scheduleFrom, setScheduleFrom] = useState(todayLocalDateStr());
  const [scheduleTo, setScheduleTo]     = useState(addDaysLocalStr(todayLocalDateStr(), 6));
  const [scheduleRows, setScheduleRows] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError]     = useState('');

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError('');
    try {
      const data = await getRegistrations({ dateFrom: scheduleFrom, dateTo: scheduleTo, limit: 300 });
      setScheduleRows(data.registrations);
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduleLoading(false);
    }
  }, [scheduleFrom, scheduleTo]);

  useEffect(() => {
    if (view === 'schedule') loadSchedule();
  }, [view, loadSchedule]);

  const scheduleGroups = scheduleRows.reduce((groups, r) => {
    (groups[r.interview_date] ||= []).push(r);
    return groups;
  }, {});
  const scheduleDates = Object.keys(scheduleGroups).sort();

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportRegistrationsXlsx();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `baptism-registrations-${todayLocalDateStr()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)' }}>
            Baptism Candidates Dashboard
          </h1>
          {user?.role === 'admin' && (
            <button
              type="button"
              className="btn btn--outline"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? <><span className="spinner" /> Exporting…</> : '⬇️  Export to Excel'}
            </button>
          )}
        </div>

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

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
          <button
            className={`btn btn--sm ${view === 'list' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setView('list')}
          >
            List
          </button>
          <button
            className={`btn btn--sm ${view === 'schedule' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setView('schedule')}
          >
            Schedule
          </button>
        </div>

        {view === 'list' ? (
          <>
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
          </>
        ) : (
          <ScheduleView
            scheduleFrom={scheduleFrom}
            scheduleTo={scheduleTo}
            setScheduleFrom={setScheduleFrom}
            setScheduleTo={setScheduleTo}
            loading={scheduleLoading}
            error={scheduleError}
            dates={scheduleDates}
            groups={scheduleGroups}
            onRefresh={loadSchedule}
          />
        )}
      </div>
    </main>
  );
}

function ScheduleView({ scheduleFrom, scheduleTo, setScheduleFrom, setScheduleTo, loading, error, dates, groups, onRefresh }) {
  function quickRange(days) {
    const from = todayLocalDateStr();
    setScheduleFrom(from);
    setScheduleTo(addDaysLocalStr(from, days - 1));
  }

  return (
    <>
      <div className="table-toolbar">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input type="date" className="form-input" value={scheduleFrom} onChange={e => setScheduleFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input type="date" className="form-input" value={scheduleTo} onChange={e => setScheduleTo(e.target.value)} />
        </div>
        <button className="btn btn--secondary btn--sm" onClick={() => quickRange(1)}>Today</button>
        <button className="btn btn--secondary btn--sm" onClick={() => quickRange(7)}>Next 7 Days</button>
        <button className="btn btn--primary btn--sm" onClick={onRefresh}>Refresh</button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="table-wrap"><div className="empty-state"><p>Loading…</p></div></div>
      ) : dates.length === 0 ? (
        <div className="table-wrap"><div className="empty-state"><p>No interviews scheduled in this range.</p></div></div>
      ) : (
        dates.map(date => (
          <div key={date} className="table-wrap" style={{ marginBottom: '1rem' }}>
            <div style={{
              padding: '.75rem 1rem', fontWeight: 700, color: 'var(--blue-900)',
              background: 'var(--blue-50)', borderBottom: '1px solid var(--blue-100)',
            }}>
              {formatDateWithDay(date)} · {groups[date].length} interview{groups[date].length === 1 ? '' : 's'}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Reg Number</th>
                  <th>Full Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groups[date].map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{formatTime(r.interview_time)}</td>
                    <td><span className="td-reg">{r.reg_number}</span></td>
                    <td><span className="td-name">{r.full_name}</span></td>
                    <td>{r.phone_number}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <Link to={`/interviewer/candidate/${r.id}`} className="btn btn--outline btn--sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </>
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
