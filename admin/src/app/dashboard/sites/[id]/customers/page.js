'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getCustomers } from '../../../../../lib/api';

export default function CustomersPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    getCustomers(siteId, search || undefined)
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [session, siteId, search]);

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Customer records for this site</p>
        </div>
        <Link href={`/dashboard/sites/${siteId}/customers/new`} className="btn btn-primary">
          Add Customer
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="input"
          placeholder="Search by name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {loading && <p className="text-muted">Loading customers...</p>}
      {!loading && list.length === 0 && (
        <div className="card">
          <p className="text-muted">No customers yet. Add a customer or convert a lead.</p>
          <Link href={`/dashboard/sites/${siteId}/customers/new`} className="btn btn-primary" style={{ marginTop: 12 }}>
            Add Customer
          </Link>
        </div>
      )}

      {!loading && list.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>
                      <div>{c.email || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{c.phone || '—'}</div>
                    </td>
                    <td>{c.company || '—'}</td>
                    <td>
                      <Link href={`/dashboard/sites/${siteId}/customers/${c.id}`} className="btn btn-secondary btn-sm">
                        View
                      </Link>
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
