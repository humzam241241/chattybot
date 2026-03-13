'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from '../../components/Sidebar';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { user, loading, hasAccess, isAdmin, subscription } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/sign-in');
      }
    }
  }, [user, loading, hasAccess, isAdmin, router]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background: #ffffff;
            color: #475569;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {subscription?.status === 'trialing' && subscription?.trialEndsAt && (
          <TrialBanner trialEndsAt={subscription.trialEndsAt} />
        )}
        {!hasAccess && !isAdmin && (
          <PaywallBanner />
        )}
        {children}
      </main>
    </div>
  );
}

function TrialBanner({ trialEndsAt }) {
  const daysLeft = Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft <= 0) return null;

  return (
    <div className="trial-banner">
      <span>
        {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your free trial.
      </span>
      <a href="/pricing">Upgrade now</a>
      <style jsx>{`
        .trial-banner {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          padding: 12px 24px;
          text-align: center;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }
        .trial-banner a {
          color: white;
          font-weight: 600;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

function PaywallBanner() {
  return (
    <div className="paywall-banner">
      <div className="paywall-title">Upgrade required</div>
      <div className="paywall-subtitle">
        You can browse the dashboard, but actions and data access are locked until you upgrade.
      </div>
      <a className="paywall-cta" href="/pricing">View plans</a>
      <style jsx>{`
        .paywall-banner {
          margin: 16px 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .paywall-title {
          font-weight: 700;
        }
        .paywall-subtitle {
          color: var(--muted);
          font-size: 13px;
          flex: 1;
          min-width: 240px;
        }
        .paywall-cta {
          background: var(--primary);
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 13px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
