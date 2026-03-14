'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { getInvoice, addInvoiceLineItem, markInvoicePaid, sendInvoice } from '../../../../../../lib/api';

export default function InvoiceDetailPage() {
  const { id: siteId, invoice_id: invoiceId } = useParams();
  const { session } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState(0);

  useEffect(() => {
    if (!session?.access_token || !siteId || !invoiceId) return;
    getInvoice(siteId, invoiceId).then(setInvoice).catch(() => setInvoice(null)).finally(() => setLoading(false));
  }, [session, siteId, invoiceId]);

  async function handleAddLine(e) {
    e.preventDefault();
    if (!newDesc.trim()) return;
    try {
      await addInvoiceLineItem(siteId, invoiceId, { description: newDesc.trim(), quantity: newQty, unit_price: newPrice });
      const inv = await getInvoice(siteId, invoiceId);
      setInvoice(inv);
      setNewDesc(''); setNewQty(1); setNewPrice(0);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSend() {
    try {
      await sendInvoice(siteId, invoiceId);
      setInvoice(await getInvoice(siteId, invoiceId));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleMarkPaid() {
    try {
      await markInvoicePaid(siteId, invoiceId);
      setInvoice(await getInvoice(siteId, invoiceId));
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading || !invoice) return <SiteLayout siteId={siteId}><p className="text-muted">Loading…</p></SiteLayout>;

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link href={`/dashboard/sites/${siteId}/invoices`} className="text-muted" style={{ fontSize: 14 }}>← Invoices</Link>
          <h1 className="page-title">Invoice</h1>
          <p className="page-subtitle">{invoice.customer_name} · {invoice.status}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {invoice.status === 'draft' && <button type="button" className="btn btn-primary" onClick={handleSend}>Send</button>}
          {(invoice.status === 'sent' || invoice.status === 'draft') && <button type="button" className="btn btn-secondary" onClick={handleMarkPaid}>Mark Paid</button>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Line items</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
            <tbody>
              {(invoice.line_items || []).map((li) => (
                <tr key={li.id}>
                  <td>{li.description}</td>
                  <td>{li.quantity}</td>
                  <td>${Number(li.unit_price).toFixed(2)}</td>
                  <td>${Number(li.quantity * li.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={handleAddLine} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input type="text" className="input" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ minWidth: 200 }} />
          <input type="number" className="input" placeholder="Qty" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} style={{ width: 70 }} />
          <input type="number" step="0.01" className="input" placeholder="Price" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} style={{ width: 90 }} />
          <button type="submit" className="btn btn-primary btn-sm">Add line</button>
        </form>
        <p style={{ marginTop: 12, fontWeight: 600 }}>Total: ${Number(invoice.total_amount || 0).toFixed(2)}</p>
      </div>
    </SiteLayout>
  );
}
