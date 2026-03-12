'use client';

import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing-page">
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
          <nav className="header-nav">
            <Link href="/about">About</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/contact">Contact</Link>
          </nav>
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

      <main>
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              AI-Powered Chatbots{' '}
              <span className="gradient-text">That Convert Visitors to Leads</span>
            </h1>
            <p className="hero-subtitle">
              Deploy intelligent chatbots on your website in minutes.
              Capture leads 24/7, answer questions instantly, and never miss an opportunity.
            </p>
            <div className="hero-cta">
              <Link href="/sign-up" className="btn btn-primary btn-lg">
                Start Free Trial
              </Link>
              <Link href="/pricing" className="btn btn-secondary btn-lg">
                View Pricing
              </Link>
            </div>
            <p className="hero-note">14-day free trial. No credit card required.</p>
          </div>
        </section>

        <section className="features">
          <h2 className="section-title">Everything You Need</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Smart AI Conversations</h3>
              <p>Powered by GPT-4, your chatbot understands context and provides accurate, helpful responses.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Lead Capture & Scoring</h3>
              <p>Automatically capture leads and score them as Hot, Warm, or Cold based on conversation intent.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>SMS & WhatsApp</h3>
              <p>Extend your reach with text message support. Same AI, different channels.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Analytics Dashboard</h3>
              <p>Track conversations, leads, conversion rates, and more with detailed analytics.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Fully Customizable</h3>
              <p>Match your brand with custom colors, personality settings, and guardrails.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Easy Integration</h3>
              <p>Add to any website with a single script tag. Works with WordPress, Shopify, and more.</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <h2>Ready to Get Started?</h2>
          <p>Join hundreds of businesses using ChattyBot to capture more leads.</p>
          <Link href="/sign-up" className="btn btn-primary btn-lg">
            Start Your Free Trial
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <span className="logo-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="logo-text">ChattyBot</span>
            <p className="footer-tagline">AI chatbots that convert.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <Link href="/pricing">Pricing</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div className="footer-col">
              <h4>Account</h4>
              <Link href="/sign-in">Sign In</Link>
              <Link href="/sign-up">Sign Up</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} ChattyBot. All rights reserved.</p>
        </div>
      </footer>

      <style jsx>{`
        .landing-header {
          position: sticky;
          top: 0;
          background: rgba(12, 15, 20, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          z-index: 100;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .header-nav {
          display: flex;
          gap: 28px;
        }

        .header-nav a {
          color: var(--text-soft);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          transition: color var(--transition);
        }

        .header-nav a:hover {
          color: var(--text);
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .hero {
          padding: 100px 24px 120px;
          text-align: center;
          background-image:
            radial-gradient(ellipse 70% 40% at 50% 0%, var(--primary-glow), transparent 60%),
            linear-gradient(180deg, var(--bg) 0%, var(--bg-elevated) 100%);
        }

        .hero-content {
          max-width: 720px;
          margin: 0 auto;
        }

        .hero-title {
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 700;
          line-height: 1.15;
          margin-bottom: 20px;
          color: var(--text);
          letter-spacing: -0.03em;
        }

        .gradient-text {
          background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 18px;
          color: var(--text-soft);
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .hero-cta {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .hero-note {
          font-size: 13px;
          color: var(--muted);
        }

        .btn-lg {
          padding: 12px 24px;
          font-size: 15px;
          border-radius: var(--radius-sm);
        }

        .features {
          padding: 88px 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-title {
          text-align: center;
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 48px;
          color: var(--text);
          letter-spacing: -0.02em;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 28px;
          transition: border-color var(--transition), box-shadow var(--transition);
        }

        .feature-card:hover {
          border-color: var(--border-strong);
          box-shadow: 0 0 0 1px var(--border-strong), 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .feature-icon {
          font-size: 28px;
          margin-bottom: 14px;
          opacity: 0.9;
        }

        .feature-card h3 {
          font-size: 17px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--text);
        }

        .feature-card p {
          color: var(--text-soft);
          font-size: 14px;
          line-height: 1.55;
        }

        .cta-section {
          padding: 80px 24px;
          text-align: center;
          background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--surface) 100%);
          border-top: 1px solid var(--border);
        }

        .cta-section h2 {
          font-size: 26px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text);
        }

        .cta-section p {
          font-size: 16px;
          color: var(--text-soft);
          margin-bottom: 28px;
        }

        .cta-section .btn {
          background: var(--primary);
          color: #fff;
        }

        .cta-section .btn:hover {
          background: var(--primary-dark);
        }

        .landing-footer {
          background: var(--surface);
          border-top: 1px solid var(--border);
          padding: 48px 24px 24px;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          gap: 48px;
          flex-wrap: wrap;
        }

        .footer-brand {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .footer-brand .logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .footer-brand .logo-text {
          font-weight: 700;
          font-size: 18px;
          color: var(--text);
        }

        .footer-tagline {
          width: 100%;
          color: var(--text-soft);
          font-size: 14px;
          margin: 0;
        }

        .footer-links {
          display: flex;
          gap: 64px;
        }

        .footer-col h4 {
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-soft);
          margin-bottom: 14px;
        }

        .footer-col a {
          display: block;
          color: var(--text-soft);
          text-decoration: none;
          font-size: 14px;
          margin-bottom: 8px;
          transition: color var(--transition);
        }

        .footer-col a:hover {
          color: var(--text);
        }

        .footer-bottom {
          max-width: 1200px;
          margin: 48px auto 0;
          padding-top: 24px;
          border-top: 1px solid var(--border);
          text-align: center;
          color: var(--muted);
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .header-nav {
            display: none;
          }

          .hero-title {
            font-size: 32px;
          }

          .hero-cta {
            flex-direction: column;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
