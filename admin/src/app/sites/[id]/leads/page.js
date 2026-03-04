'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getLeads, getSite } from '../../../../lib/api';
import SiteLayout from '../../../../components/SiteLayout';

export default function LeadsPage() {
  const { id } = useParams();
  const [leads, setLeads] = useState([]);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSite(id), getLeads(id)])
      .then(([siteData, leadsData]) => {
        setSite(siteData.site);
        setLeads(leadsData.leads || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function exportCSV() {
    const header = 'Name,Email,Message,Date\n';
    const rows = leads
      .map((l) =>
        [l.name || '', l.email, (l.message || '').replace(/\n/g, ' '), new Date(l.created_at).toLocaleString()]
          .map((v) => `"${v.replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${id}.csv`;
    a.click();
  }

  return (
    <SiteLayout siteName={site?.company_name || 'Loading...'}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">Captured contacts from your chatbot</p>
        </div>
        <div className="flex gap-2">
          {leads.length > 0 && (
            <button className="btn btn-secondary" onClick={exportCSV}>
              ↓ Export CSV
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading leads...</p>}

      {!loading && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Message</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                      No leads captured yet.
                    </td>
                  </tr>
                )}
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.name || <span className="text-muted">—</span>}</td>
                    <td>
                      <a href={`mailto:${lead.email}`} style={{ color: 'var(--primary)' }}>
                        {lead.email}
                      </a>
                    </td>
                    <td style={{ maxWidth: 280, color: 'var(--muted)' }}>
                      {lead.message
                        ? lead.message.length > 120
                          ? lead.message.slice(0, 120) + '...'
                          : lead.message
                        : '—'}
                    </td>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(lead.created_at).toLocaleDateString()}{' '}
                      {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
