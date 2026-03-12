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
            <span className="logo-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
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
        .landing-header {
          background: rgba(12, 15, 20, 0.85);
          backdrop-filter: blur(12px);
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

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .pricing-main {
          max-width: 1000px;
          margin: 0 auto;
          padding: 88px 24px;
          text-align: center;
          background-image: radial-gradient(ellipse 60% 30% at 50% 0%, var(--primary-glow), transparent 55%);
        }

        .pricing-main h1 {
          font-size: clamp(28px, 4vw, 36px);
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text);
          letter-spacing: -0.02em;
        }

        .pricing-subtitle {
          font-size: 16px;
          color: var(--text-soft);
          margin-bottom: 44px;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin: 0 auto;
          text-align: left;
        }

        .pricing-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 28px;
          position: relative;
          transition: border-color var(--transition), box-shadow var(--transition);
        }

        .pricing-card:hover {
          border-color: var(--border-strong);
        }

        .pricing-card.popular {
          border-color: var(--primary);
          box-shadow: 0 0 0 1px var(--primary), 0 8px 24px var(--primary-glow);
        }

        .popular-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--primary);
          color: #fff;
          padding: 4px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .pricing-header {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .pricing-header h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text);
        }

        .price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .amount {
          font-size: 40px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.02em;
        }

        .period {
          font-size: 15px;
          color: var(--text-soft);
        }

        .savings {
          margin-top: 6px;
          color: #34d399;
          font-weight: 500;
          font-size: 13px;
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
        }

        .features-list li {
          padding: 6px 0;
          color: var(--text-soft);
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .features-list li::before {
          content: "✓";
          color: var(--primary);
          font-weight: 600;
          flex-shrink: 0;
        }

        .btn-full {
          width: 100%;
          padding: 12px 16px;
          font-size: 15px;
          border-radius: var(--radius-sm);
        }

        @media (max-width: 768px) {
          .pricing-main h1 {
            font-size: 28px;
          }

          .pricing-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
