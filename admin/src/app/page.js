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
            <span className="logo-icon">🤖</span>
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
              AI-Powered Chatbots<br />
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
            <span className="logo-icon">🤖</span>
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
        .landing-page {
          min-height: 100vh;
          background: var(--bg);
        }

        .landing-header {
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
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

        .header-nav {
          display: flex;
          gap: 32px;
        }

        .header-nav a {
          color: var(--muted);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .header-nav a:hover {
          color: var(--text);
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .hero {
          padding: 80px 24px 100px;
          text-align: center;
          background: linear-gradient(180deg, var(--bg) 0%, rgba(99, 102, 241, 0.05) 100%);
        }

        .hero-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .hero-title {
          font-size: 56px;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
          color: var(--text);
        }

        .gradient-text {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 20px;
          color: var(--muted);
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .hero-cta {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 16px;
        }

        .hero-note {
          font-size: 14px;
          color: var(--muted);
        }

        .btn-lg {
          padding: 14px 28px;
          font-size: 16px;
        }

        .features {
          padding: 80px 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-title {
          text-align: center;
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 48px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }

        .feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          transition: all 0.2s;
        }

        .feature-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(99, 102, 241, 0.1);
        }

        .feature-icon {
          font-size: 40px;
          margin-bottom: 16px;
        }

        .feature-card h3 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .feature-card p {
          color: var(--muted);
          line-height: 1.6;
        }

        .cta-section {
          padding: 80px 24px;
          text-align: center;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }

        .cta-section h2 {
          font-size: 36px;
          margin-bottom: 16px;
        }

        .cta-section p {
          font-size: 18px;
          opacity: 0.9;
          margin-bottom: 32px;
        }

        .cta-section .btn {
          background: white;
          color: #6366f1;
        }

        .cta-section .btn:hover {
          background: #f8f8f8;
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

        .footer-brand .logo-icon {
          font-size: 32px;
        }

        .footer-tagline {
          color: var(--muted);
          margin-top: 8px;
        }

        .footer-links {
          display: flex;
          gap: 64px;
        }

        .footer-col h4 {
          font-weight: 600;
          margin-bottom: 16px;
        }

        .footer-col a {
          display: block;
          color: var(--muted);
          text-decoration: none;
          margin-bottom: 8px;
          transition: color 0.2s;
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
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .header-nav {
            display: none;
          }

          .hero-title {
            font-size: 36px;
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
