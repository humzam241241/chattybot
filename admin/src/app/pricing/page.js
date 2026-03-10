'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { createCheckoutSession, getSites } from '../../lib/api';

export default function PricingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--muted)' }}>Loading...</div>}>
      <PricingInner />
    </Suspense>
  );
}

function PricingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasAccess } = useAuth();
  const [loading, setLoading] = useState(null);
  const canceled = searchParams.get('canceled');
  const siteIdParam = searchParams.get('site_id');
  const [resolvedSiteId, setResolvedSiteId] = useState(siteIdParam || null);
  const [siteResolved, setSiteResolved] = useState(false);

  useEffect(() => {
    setResolvedSiteId(siteIdParam || null);
  }, [siteIdParam]);

  useEffect(() => {
    let cancelled = false;
    async function resolveSite() {
      if (!user) return;
      if (resolvedSiteId) return;
      try {
        const data = await getSites();
        const sites = Array.isArray(data?.sites) ? data.sites : [];
        const mostRecent = sites[0]?.id || null;
        if (!cancelled) setResolvedSiteId(mostRecent);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSiteResolved(true);
      }
    }
    resolveSite();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, resolvedSiteId]);

  async function handleCheckout(plan) {
    if (!user) {
      router.push('/sign-up');
      return;
    }

    const siteId = resolvedSiteId || null;
    if (!siteId) {
      alert('Create a client/site first, then pick a plan.');
      router.push('/dashboard/sites/new');
      return;
    }

    setLoading(plan);
    try {
      const { url } = await createCheckoutSession(plan, siteId);
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      alert(err.message || 'Failed to start checkout');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="pricing-page">
      <header className="landing-header">
        <div className="header-container">
          <Link href="/" className="logo">
            <span className="logo-icon">🤖</span>
            <span className="logo-text">ChattyBot</span>
          </Link>
          <div className="header-actions">
            {user ? (
              <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
            ) : (
              <>
                <Link href="/sign-in" className="btn btn-secondary">Sign In</Link>
                <Link href="/sign-up" className="btn btn-primary">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="pricing-main">
        <h1>Simple, Transparent Pricing</h1>
        <p className="pricing-subtitle">
          Choose a monthly plan. Limits are messages per month.
        </p>

        {canceled && (
          <div className="alert alert-info" style={{ maxWidth: 600, margin: '0 auto 32px' }}>
            Checkout was canceled. Feel free to try again when you're ready.
          </div>
        )}

        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-header">
              <h3>Pro</h3>
              <div className="price">
                <span className="amount">$50</span>
                <span className="period">/month</span>
              </div>
              <div className="savings">5,000 messages / month</div>
            </div>
            <ul className="features-list">
              <li>Unlimited chatbots</li>
              <li>Unlimited conversations</li>
              <li>Lead capture & scoring</li>
              <li>SMS & WhatsApp support</li>
              <li>Analytics dashboard</li>
              <li>Email notifications</li>
            </ul>
            <button 
              className="btn btn-primary btn-full"
              onClick={() => handleCheckout('pro')}
              disabled={loading === 'pro'}
            >
              {loading === 'pro' ? 'Loading...' : 'Choose Pro'}
            </button>
          </div>

          <div className="pricing-card popular">
            <div className="popular-badge">Most Popular</div>
            <div className="pricing-header">
              <h3>Plus</h3>
              <div className="price">
                <span className="amount">$150</span>
                <span className="period">/month</span>
              </div>
              <div className="savings">10,000 messages / month</div>
            </div>
            <ul className="features-list">
              <li>Everything in Pro</li>
              <li>Priority support</li>
              <li>Early access to new features</li>
              <li>Custom onboarding</li>
            </ul>
            <button 
              className="btn btn-primary btn-full"
              onClick={() => handleCheckout('plus')}
              disabled={loading === 'plus'}
            >
              {loading === 'plus' ? 'Loading...' : 'Choose Plus'}
            </button>
          </div>

          <div className="pricing-card">
            <div className="pricing-header">
              <h3>Ultra</h3>
              <div className="price">
                <span className="amount">$400</span>
                <span className="period">/month</span>
              </div>
              <div className="savings">20,000 messages / month</div>
            </div>
            <ul className="features-list">
              <li>Everything in Plus</li>
              <li>White-label option</li>
              <li>Dedicated support</li>
            </ul>
            <button 
              className="btn btn-secondary btn-full"
              onClick={() => handleCheckout('ultra')}
              disabled={loading === 'ultra'}
            >
              {loading === 'ultra' ? 'Loading...' : 'Choose Ultra'}
            </button>
          </div>
        </div>
      </main>

      <style jsx>{`
        .pricing-page {
          min-height: 100vh;
          background: var(--bg);
        }

        .landing-header {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-weight: 700;
          font-size: 20px;
          color: var(--text);
        }

        .logo-icon {
          font-size: 28px;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .pricing-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 24px;
          text-align: center;
        }

        .pricing-main h1 {
          font-size: 42px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .pricing-subtitle {
          font-size: 18px;
          color: var(--muted);
          margin-bottom: 48px;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .pricing-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          text-align: left;
          position: relative;
        }

        .pricing-card.popular {
          border-color: var(--primary);
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--primary);
          color: white;
          padding: 4px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .pricing-header {
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border);
        }

        .pricing-header h3 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .amount {
          font-size: 48px;
          font-weight: 800;
          color: var(--text);
        }

        .period {
          font-size: 16px;
          color: var(--muted);
        }

        .savings {
          margin-top: 8px;
          color: #10b981;
          font-weight: 600;
          font-size: 14px;
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
        }

        .features-list li {
          padding: 8px 0;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .features-list li::before {
          content: "✓";
          color: var(--primary);
          font-weight: 600;
        }

        .btn-full {
          width: 100%;
          padding: 14px;
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .pricing-main h1 {
            font-size: 32px;
          }

          .pricing-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
