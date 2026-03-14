'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getSite, getScheduleForDay, getTechnicians, getJob, getJobs, createAppointment } from '../../../../../lib/api';

function normalizeRaffy(site) {
  if (!site) return {};
  let ro = site.raffy_overrides;
  if (typeof ro === 'string') {
    try { ro = JSON.parse(ro); } catch { ro = {}; }
  }
  return ro && typeof ro === 'object' ? ro : {};
}

export default function DispatchPage() {
  const { id: siteId } = useParams();
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get('job_id');
  const { session } = useAuth();
  const [site, setSite] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobForAppointment, setJobForAppointment] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    job_id: '',
    start_time: '',
    end_time: '',
    technician_id: '',
    notes: '',
  });
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [activeView, setActiveView] = useState('calendar'); // 'calendar' | 'list'

  const bookingUrl = (normalizeRaffy(site).booking?.url || '').trim();

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    getSite(siteId)
      .then((data) => {
        const s = data?.site;
        if (s) setSite(s);
      })
      .catch(() => setSite(null));
  }, [session, siteId]);

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    Promise.all([getScheduleForDay(siteId, date), getTechnicians(siteId, true)])
      .then(([s, t]) => {
        setSchedule(s || []);
        setTechnicians(t || []);
      })
      .catch(() => { setSchedule([]); setTechnicians([]); })
      .finally(() => setLoading(false));
  }, [session, siteId, date]);

  useEffect(() => {
    if (!jobIdFromUrl || !siteId || !session?.access_token) return;
    getJob(siteId, jobIdFromUrl)
      .then((j) => { setJobForAppointment(j); setShowAppointmentForm(true); })
      .catch(() => setJobForAppointment(null));
  }, [jobIdFromUrl, siteId, session?.access_token]);

  useEffect(() => {
    if (!siteId || !session?.access_token || !showAppointmentForm) return;
    getJobs(siteId, {}).then(setJobs).catch(() => setJobs([]));
  }, [siteId, session?.access_token, showAppointmentForm]);

  async function loadSchedule() {
    if (!siteId) return;
    setLoading(true);
    try {
      const s = await getScheduleForDay(siteId, date);
      setSchedule(s || []);
    } catch { setSchedule([]); }
    setLoading(false);
  }

  async function handleCreateAppointment(e) {
    e.preventDefault();
    const jobId = jobForAppointment?.id || appointmentForm.job_id;
    if (!jobId || !appointmentForm.start_time || !appointmentForm.end_time) return;
    setSavingAppointment(true);
    try {
      await createAppointment(siteId, {
        job_id: jobId,
        start_time: new Date(`${date}T${appointmentForm.start_time}`).toISOString(),
        end_time: new Date(`${date}T${appointmentForm.end_time}`).toISOString(),
        technician_id: appointmentForm.technician_id || undefined,
        notes: appointmentForm.notes || undefined,
      });
      setShowAppointmentForm(false);
      setJobForAppointment(null);
      setAppointmentForm({ job_id: '', start_time: '', end_time: '', technician_id: '', notes: '' });
      await loadSchedule();
      window.history.replaceState({}, '', `/dashboard/sites/${siteId}/dispatch`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingAppointment(false);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispatch</h1>
          <p className="page-subtitle">Calendar and appointments</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeView === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('calendar')}
          >
            Cal.ai / Calendar
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeView === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveView('list')}
          >
            Appointments list
          </button>
          {activeView === 'list' && (
            <>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
              <button type="button" className="btn btn-secondary" onClick={loadSchedule} disabled={loading}>
                {loading ? '...' : 'Refresh'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { setJobForAppointment(null); setShowAppointmentForm(true); setAppointmentForm({ job_id: '', start_time: '', end_time: '', technician_id: '', notes: '' }); }}>
                New appointment
              </button>
            </>
          )}
        </div>
      </div>

      {activeView === 'calendar' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>Cal.com / Cal.ai — your scheduling calendar</span>
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                Open in new tab
              </a>
            )}
          </div>
          {bookingUrl ? (
            <div style={{ position: 'relative', width: '100%', minHeight: 640, borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
              <iframe
                src={bookingUrl}
                title="Cal.com / Cal.ai calendar"
                style={{ width: '100%', height: 640, border: 0 }}
                allow="camera; microphone; fullscreen"
              />
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', background: 'var(--bg)', borderRadius: 8 }}>
              <p style={{ marginBottom: 12 }}>Add a Cal.com or Cal.ai booking link to see your calendar here.</p>
              <p style={{ fontSize: 14, marginBottom: 16 }}>Go to <strong>Settings</strong> → <strong>Booking</strong> and set <strong>Booking Link URL</strong> (e.g. <code style={{ fontSize: 12 }}>https://cal.com/your-team/intro</code>).</p>
              <Link href={`/dashboard/sites/${siteId}/settings`} className="btn btn-primary">Open Settings</Link>
            </div>
          )}
        </div>
      )}

      {activeView === 'list' && showAppointmentForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">{jobForAppointment ? `New appointment: ${jobForAppointment.title}` : 'New appointment'}</div>
          <form onSubmit={handleCreateAppointment} style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
            {!jobForAppointment && (
              <div>
                <label className="block" style={{ marginBottom: 4, fontSize: 13 }}>Job *</label>
                <select className="input" value={appointmentForm.job_id} onChange={(e) => setAppointmentForm((f) => ({ ...f, job_id: e.target.value }))} required>
                  <option value="">Select job</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} — {j.customer_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block" style={{ marginBottom: 4, fontSize: 13 }}>Date</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="block" style={{ marginBottom: 4, fontSize: 13 }}>Start time</label>
                <input type="time" className="input" value={appointmentForm.start_time} onChange={(e) => setAppointmentForm((f) => ({ ...f, start_time: e.target.value }))} required />
              </div>
              <div>
                <label className="block" style={{ marginBottom: 4, fontSize: 13 }}>End time</label>
                <input type="time" className="input" value={appointmentForm.end_time} onChange={(e) => setAppointmentForm((f) => ({ ...f, end_time: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="block" style={{ marginBottom: 4, fontSize: 13 }}>Technician</label>
              <select className="input" value={appointmentForm.technician_id} onChange={(e) => setAppointmentForm((f) => ({ ...f, technician_id: e.target.value }))}>
                <option value="">— None —</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block" style={{ marginBottom: 4, fontSize: 13 }}>Notes</label>
              <input type="text" className="input" value={appointmentForm.notes} onChange={(e) => setAppointmentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={savingAppointment}>{savingAppointment ? '...' : 'Create appointment'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowAppointmentForm(false); setJobForAppointment(null); window.history.replaceState({}, '', `/dashboard/sites/${siteId}/dispatch`); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {activeView === 'list' && loading && <p className="text-muted">Loading schedule...</p>}

      {activeView === 'list' && !loading && (
        <div className="card">
          <div className="card-title">Appointments for {date}</div>
          {schedule.length === 0 ? (
            <p className="text-muted">No appointments this day.</p>
          ) : (
            <div className="table-wrap">
              <table style={{ minWidth: 500 }}>
                <thead>
                  <tr><th>Time</th><th>Job</th><th>Customer</th><th>Technician</th><th></th></tr>
                </thead>
                <tbody>
                  {schedule.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td><Link href={`/dashboard/sites/${siteId}/jobs/${a.job_id}`}>{a.job_title}</Link></td>
                      <td>{a.customer_name}</td>
                      <td>{a.technician_name || '—'}</td>
                      <td><span className="badge">{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeView === 'list' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Technicians ({technicians.length})</div>
          {technicians.length === 0 ? <p className="text-muted">No technicians. Add one to assign to appointments.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {technicians.map((t) => (
                <li key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{t.name} {t.role && <span className="text-muted">({t.role})</span>}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SiteLayout>
  );
}
