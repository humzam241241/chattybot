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
      } else if (!hasAccess && !isAdmin) {
        router.push('/pricing?trial_expired=true');
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
            color: var(--muted);
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

  if (!hasAccess && !isAdmin) {
    return null;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        {subscription?.status === 'trialing' && subscription?.trialEndsAt && (
          <TrialBanner trialEndsAt={subscription.trialEndsAt} />
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
