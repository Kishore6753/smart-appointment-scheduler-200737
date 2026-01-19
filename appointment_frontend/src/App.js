import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import { api, setToken } from './api';

function formatLocal(dt) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    return d.toLocaleString();
  } catch {
    return String(dt);
  }
}

function toIsoLocalInputValue(date) {
  // Convert a Date to yyyy-MM-ddTHH:mm (local)
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalInputToIso(value) {
  // Value is "YYYY-MM-DDTHH:mm" in local time; Date will interpret local, toISOString makes UTC.
  const d = new Date(value);
  return d.toISOString();
}

function Panel({ title, children }) {
  return (
    <section className="panel" aria-label={title}>
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

// PUBLIC_INTERFACE
function App() {
  const [authMode, setAuthMode] = useState('login'); // login|register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [me, setMe] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);

  const [apptStart, setApptStart] = useState(toIsoLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [apptEnd, setApptEnd] = useState(toIsoLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [apptNotes, setApptNotes] = useState('');

  const [availStart, setAvailStart] = useState(toIsoLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [availEnd, setAvailEnd] = useState(toIsoLocalInputValue(new Date(Date.now() + 25 * 60 * 60 * 1000)));
  const [availFlag, setAvailFlag] = useState(true);

  const isAuthed = !!me;
  const isAdmin = me?.role === 'admin';

  const headerSubtitle = useMemo(() => {
    if (!isAuthed) return 'Sign in to book, reschedule, or cancel appointments.';
    return `Signed in as ${me.email} (${me.role})`;
  }, [isAuthed, me]);

  async function refreshAll() {
    setErrorMsg('');
    setStatusMsg('');
    const user = await api.me();
    setMe(user);
    const appts = await api.listAppointments();
    setAppointments(appts);
    if (user.role === 'admin') {
      const av = await api.listAvailability();
      setAvailability(av);
    } else {
      setAvailability([]);
    }
  }

  useEffect(() => {
    // Try restore session
    (async () => {
      try {
        await refreshAll();
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAuthSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    try {
      const payload = { email, password };
      const resp =
        authMode === 'register' ? await api.register({ ...payload }) : await api.login({ ...payload });

      setToken(resp.access_token);
      setMe(resp.user);
      setStatusMsg('Authenticated.');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err.message || 'Auth failed');
    }
  }

  async function onLogout() {
    setToken(null);
    setMe(null);
    setAppointments([]);
    setAvailability([]);
    setStatusMsg('Signed out.');
    setErrorMsg('');
  }

  async function onCreateAppointment(e) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await api.createAppointment({
        start_time: parseLocalInputToIso(apptStart),
        end_time: parseLocalInputToIso(apptEnd),
        notes: apptNotes || null,
      });
      setApptNotes('');
      setStatusMsg('Appointment created.');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create appointment');
    }
  }

  async function onCancelAppointment(id) {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await api.cancelAppointment(id);
      setStatusMsg('Appointment cancelled.');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel appointment');
    }
  }

  async function onRescheduleAppointment(id) {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await api.rescheduleAppointment(id, {
        start_time: parseLocalInputToIso(apptStart),
        end_time: parseLocalInputToIso(apptEnd),
      });
      setStatusMsg('Appointment rescheduled.');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reschedule appointment');
    }
  }

  async function onAddAvailability(e) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await api.upsertAvailability({
        start_time: parseLocalInputToIso(availStart),
        end_time: parseLocalInputToIso(availEnd),
        is_available: !!availFlag,
      });
      setStatusMsg('Availability saved.');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save availability');
    }
  }

  async function onDeleteAvailability(id) {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await api.deleteAvailability(id);
      setStatusMsg('Availability deleted.');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete availability');
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div>
            <div className="brand-title">Appointments</div>
            <div className="brand-subtitle">{headerSubtitle}</div>
          </div>
        </div>

        <div className="sidebar-actions">
          {!isAuthed ? (
            <div className="segmented" role="tablist" aria-label="Auth mode">
              <button
                type="button"
                className={authMode === 'login' ? 'segmented-btn active' : 'segmented-btn'}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'segmented-btn active' : 'segmented-btn'}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
            </div>
          ) : (
            <button type="button" className="primary-btn" onClick={onLogout}>
              Sign out
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="hint">
            Backend: set <code>REACT_APP_API_BASE_URL</code> (optional). Default: http://localhost:3001
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="page-title">Booking Dashboard</h1>
          <div className="status">
            {statusMsg ? <span className="status-ok">{statusMsg}</span> : null}
            {errorMsg ? <span className="status-err">{errorMsg}</span> : null}
          </div>
        </header>

        {!isAuthed ? (
          <Panel title="Authenticate">
            <form className="form" onSubmit={onAuthSubmit}>
              <label className="field">
                <span>Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
              </label>
              <label className="field">
                <span>Password</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
              </label>
              <button type="submit" className="primary-btn">
                {authMode === 'login' ? 'Login' : 'Register'}
              </button>
              <div className="hint">
                To act as admin, register with role <code>admin</code> via API directly (POST /auth/register). UI keeps registration simple.
              </div>
            </form>
          </Panel>
        ) : (
          <div className="grid">
            <Panel title="Create / Reschedule time selector">
              <form className="form" onSubmit={onCreateAppointment}>
                <div className="row">
                  <label className="field">
                    <span>Start</span>
                    <input value={apptStart} onChange={(e) => setApptStart(e.target.value)} type="datetime-local" required />
                  </label>
                  <label className="field">
                    <span>End</span>
                    <input value={apptEnd} onChange={(e) => setApptEnd(e.target.value)} type="datetime-local" required />
                  </label>
                </div>
                <label className="field">
                  <span>Notes</span>
                  <input value={apptNotes} onChange={(e) => setApptNotes(e.target.value)} placeholder="Optional" />
                </label>
                <button type="submit" className="primary-btn">Book appointment</button>
                <div className="hint">
                  Booking requires an admin availability window that fully covers the requested interval.
                </div>
              </form>
            </Panel>

            <Panel title={isAdmin ? 'All Appointments (admin)' : 'My Appointments'}>
              <div className="table">
                <div className="table-head">
                  <div>ID</div>
                  <div>Start</div>
                  <div>End</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                {appointments.length === 0 ? (
                  <div className="table-empty">No appointments yet.</div>
                ) : (
                  appointments.map((a) => (
                    <div className="table-row" key={a.id}>
                      <div className="mono" title={a.id}>{a.id.slice(0, 8)}…</div>
                      <div>{formatLocal(a.start_time)}</div>
                      <div>{formatLocal(a.end_time)}</div>
                      <div><span className={a.status === 'cancelled' ? 'badge bad' : 'badge'}>{a.status}</span></div>
                      <div className="actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          disabled={a.status !== 'scheduled'}
                          onClick={() => onRescheduleAppointment(a.id)}
                        >
                          Reschedule to selected time
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={a.status !== 'scheduled'}
                          onClick={() => onCancelAppointment(a.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            {isAdmin ? (
              <Panel title="Admin Availability">
                <form className="form" onSubmit={onAddAvailability}>
                  <div className="row">
                    <label className="field">
                      <span>Start</span>
                      <input value={availStart} onChange={(e) => setAvailStart(e.target.value)} type="datetime-local" required />
                    </label>
                    <label className="field">
                      <span>End</span>
                      <input value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} type="datetime-local" required />
                    </label>
                  </div>
                  <label className="field">
                    <span>Available?</span>
                    <select value={availFlag ? 'yes' : 'no'} onChange={(e) => setAvailFlag(e.target.value === 'yes')}>
                      <option value="yes">Yes</option>
                      <option value="no">No (block time)</option>
                    </select>
                  </label>
                  <button type="submit" className="primary-btn">Add window</button>
                </form>

                <div className="table" style={{ marginTop: 12 }}>
                  <div className="table-head">
                    <div>ID</div>
                    <div>Start</div>
                    <div>End</div>
                    <div>Available</div>
                    <div>Actions</div>
                  </div>
                  {availability.length === 0 ? (
                    <div className="table-empty">No availability windows yet.</div>
                  ) : (
                    availability.map((w) => (
                      <div className="table-row" key={w.id}>
                        <div className="mono" title={w.id}>{w.id.slice(0, 8)}…</div>
                        <div>{formatLocal(w.start_time)}</div>
                        <div>{formatLocal(w.end_time)}</div>
                        <div><span className={w.is_available ? 'badge' : 'badge bad'}>{w.is_available ? 'yes' : 'no'}</span></div>
                        <div className="actions">
                          <button type="button" className="danger-btn" onClick={() => onDeleteAvailability(w.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
