'use client';

import Link from 'next/link';

export default function UsageCard({ usage, siteId }) {
  if (!usage) return null;

  const { plan, used, limit, remaining, percent } = usage;
  const warn = percent >= 80 && percent < 100;
  const reached = percent >= 100 || remaining <= 0;

  return (
    <div className={`usage-card ${warn ? 'warn' : ''} ${reached ? 'reached' : ''}`}>
      <div className="usage-header">
        <div>
          <h3>Message Usage</h3>
          <p className="usage-subtitle">
            Plan: <strong style={{ textTransform: 'capitalize' }}>{plan}</strong>
          </p>
        </div>
        <div className="usage-meta">
          <div className="usage-numbers">
            <strong>{used}</strong> / {limit}
          </div>
          <div className="usage-remaining">{remaining} remaining</div>
        </div>
      </div>

      <div className="progress-wrap" aria-label="Usage progress">
        <div className="progress-bar" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>

      {warn && !reached && (
        <div className="usage-warning">
          You’ve used {percent}% of your monthly quota. Consider upgrading to avoid interruptions.
        </div>
      )}

      {reached && (
        <div className="usage-warning">
          <strong>You have reached your plan limit.</strong> Upgrade to continue.
          <div style={{ marginTop: 10 }}>
            <Link href={siteId ? `/pricing?site_id=${siteId}` : '/pricing'} className="btn btn-primary btn-sm">Upgrade Plan</Link>
          </div>
        </div>
      )}

      <style jsx>{`
        .usage-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }

        .usage-card.warn {
          border-color: rgba(245, 158, 11, 0.4);
          background: rgba(245, 158, 11, 0.05);
        }

        .usage-card.reached {
          border-color: rgba(220, 38, 38, 0.4);
          background: rgba(220, 38, 38, 0.05);
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        h3 {
          margin: 0 0 4px;
          font-size: 16px;
        }

        .usage-subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }

        .usage-meta {
          text-align: right;
        }

        .usage-numbers {
          font-size: 14px;
          color: var(--text);
        }

        .usage-remaining {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }

        .progress-wrap {
          height: 10px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
        }

        .usage-warning {
          margin-top: 12px;
          font-size: 13px;
          color: var(--text);
        }

        .btn-sm {
          padding: 8px 12px;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>
    </div>
  );
}

