import Link from 'next/link';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatCad(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

async function fetchQuote(quoteId) {
  const url = `${API_URL}/api/estimate/${quoteId}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error || 'Failed to load quote';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export default async function QuotePage({ params }) {
  const { quoteId } = params;

  let payload = null;
  try {
    payload = await fetchQuote(quoteId);
  } catch (e) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>
        <div className="card">
          <div className="card-title">Quote not available</div>
          <div className="card-meta">{e?.message || 'Please try again later.'}</div>
          <div className="mt-4 flex gap-2">
            <Link className="btn btn-secondary" href="/">Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const { quote, booking_url } = payload;
  const low = typeof quote?.price_low === 'number' ? quote.price_low : Number(quote?.price_low);
  const high = typeof quote?.price_high === 'number' ? quote.price_high : Number(quote?.price_high);

  const serviceType = quote?.service_type || 'Service estimate';
  const roofType = quote?.roof_type ? String(quote.roof_type) : null;
  const urgency = quote?.urgency ? String(quote.urgency) : null;
  const roofSize = quote?.roof_size ? Number(quote.roof_size) : null;

  const explanationParts = [];
  if (roofType) explanationParts.push(`Roof type: ${roofType}`);
  if (urgency) explanationParts.push(`Urgency: ${urgency}`);
  if (roofSize) explanationParts.push(`Roof size: ${roofSize.toLocaleString('en-CA')} sq ft`);
  const explanation = explanationParts.length
    ? `Based on the details provided (${explanationParts.join(', ')}). Final pricing may change after an on-site assessment.`
    : 'Based on typical Ontario pricing. Final pricing may change after an on-site assessment.';

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-title">Your Quote</div>
          <div className="page-subtitle">Reference: {quote?.id}</div>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-secondary" href="/">Home</Link>
          <a
            className="btn btn-primary"
            href={booking_url || '/contact'}
            target={booking_url ? '_blank' : undefined}
            rel={booking_url ? 'noreferrer' : undefined}
          >
            Book Inspection
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{serviceType}</div>
        <div className="card-meta">{quote?.recommended_service ? `Recommended: ${quote.recommended_service}` : null}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Price range</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
              {formatCad(low)} – {formatCad(high)}
            </div>
            <div className="card-meta" style={{ marginTop: 6 }}>
              CAD, estimate only
            </div>
          </div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">Timeline</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>
              {quote?.timeline_estimate || 'Varies'}
            </div>
            <div className="card-meta" style={{ marginTop: 6 }}>
              Weather and availability can affect timing
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Explanation</div>
        <div className="card-meta" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
          {explanation}
        </div>
        {quote?.notes ? (
          <div className="mt-4">
            <div className="card-title">Notes</div>
            <div className="card-meta" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{String(quote.notes)}</div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="card-title">Next step</div>
        <div className="card-meta" style={{ marginTop: 6 }}>
          Book an inspection so we can confirm scope, materials, and access, then provide a firm quote.
        </div>
        <div className="mt-4 flex gap-2">
          <a
            className="btn btn-primary"
            href={booking_url || '/contact'}
            target={booking_url ? '_blank' : undefined}
            rel={booking_url ? 'noreferrer' : undefined}
          >
            Book Inspection
          </a>
          <Link className="btn btn-secondary" href="/">Back</Link>
        </div>
      </div>
    </div>
  );
}

