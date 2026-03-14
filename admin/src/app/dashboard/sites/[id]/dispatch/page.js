'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getScheduleForDay, getTechnicians, getAppointments } from '../../../../../lib/api';

export default function DispatchPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispatch</h1>
          <p className="page-subtitle">Schedule by day</p>
        </div>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
      </div>

      {loading && <p className="text-muted">Loading schedule...</p>}

      {!loading && (
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
    </SiteLayout>
  );
}
