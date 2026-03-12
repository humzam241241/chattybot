'use client';

import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';

export default function AboutPage() {
  const { user } = useAuth();

  return (
    <div className="about-page">
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

      <main className="about-main">
        <section className="about-hero">
          <h1>About ChattyBot</h1>
          <p className="lead">
            We help businesses capture more leads with intelligent AI chatbots.
          </p>
        </section>

        <section className="about-content">
          <div className="content-block">
            <h2>Our Mission</h2>
            <p>
              Every business deserves a 24/7 sales assistant that never sleeps, 
              never takes breaks, and always provides helpful, accurate information 
              to potential customers.
            </p>
            <p>
              ChattyBot was built to make this a reality for businesses of all sizes. 
              Our AI-powered chatbots understand your business, answer questions 
              intelligently, and capture leads automatically—so you can focus on 
              what you do best.
            </p>
          </div>

          <div className="content-block">
            <h2>How It Works</h2>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <h3>Add Your Content</h3>
                <p>We crawl your website or you upload documents to train the AI on your business.</p>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <h3>Customize Your Bot</h3>
                <p>Set the personality, colors, and guardrails to match your brand.</p>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <h3>Deploy & Capture</h3>
                <p>Add one script to your site and start capturing leads immediately.</p>
              </div>
            </div>
          </div>

          <div className="content-block">
            <h2>Technology</h2>
            <p>
              ChattyBot is powered by state-of-the-art AI technology including GPT-4 
              for natural conversations and vector embeddings for accurate information 
              retrieval. This means your chatbot doesn't just pattern-match keywords—it 
              actually understands context and provides relevant, helpful responses.
            </p>
          </div>
        </section>
      </main>

      <style jsx>{`
        .about-page {
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

        .about-main {
          max-width: 800px;
          margin: 0 auto;
          padding: 80px 24px;
        }

        .about-hero {
          text-align: center;
          margin-bottom: 64px;
        }

        .about-hero h1 {
          font-size: 42px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .lead {
          font-size: 20px;
          color: var(--muted);
        }

        .about-content {
          display: flex;
          flex-direction: column;
          gap: 48px;
        }

        .content-block h2 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .content-block p {
          color: var(--text);
          line-height: 1.8;
          margin-bottom: 16px;
        }

        .steps {
          display: grid;
          gap: 24px;
          margin-top: 24px;
        }

        .step {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .step-num {
          width: 36px;
          height: 36px;
          background: var(--primary);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          flex-shrink: 0;
        }

        .step h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .step p {
          color: var(--muted);
          margin: 0;
        }

        @media (max-width: 768px) {
          .header-nav {
            display: none;
          }

          .about-hero h1 {
            font-size: 32px;
          }
        }
      `}</style>
    </div>
  );
}
