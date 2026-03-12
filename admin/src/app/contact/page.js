'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';

export default function ContactPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="contact-page">
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

      <main className="contact-main">
        <h1>Contact Us</h1>
        <p className="lead">Have questions? We'd love to hear from you.</p>

        <div className="contact-grid">
          <div className="contact-info">
            <div className="info-item">
              <div className="info-icon">📧</div>
              <div>
                <h3>Email</h3>
                <p>support@chattybot.com</p>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">💬</div>
              <div>
                <h3>Live Chat</h3>
                <p>Available 9am - 5pm EST</p>
              </div>
            </div>
            <div className="info-item">
              <div className="info-icon">📍</div>
              <div>
                <h3>Location</h3>
                <p>Remote-first company</p>
              </div>
            </div>
          </div>

          <div className="contact-form-container">
            {submitted ? (
              <div className="success-message">
                <div className="success-icon">✓</div>
                <h2>Message Sent!</h2>
                <p>We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    type="text"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    className="textarea"
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full">
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        .contact-page {
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
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .contact-main {
          max-width: 1000px;
          margin: 0 auto;
          padding: 80px 24px;
          text-align: center;
        }

        .contact-main h1 {
          font-size: 42px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .lead {
          font-size: 18px;
          color: var(--muted);
          margin-bottom: 48px;
        }

        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 48px;
          text-align: left;
        }

        .contact-info {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .info-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .info-icon {
          font-size: 24px;
          width: 48px;
          height: 48px;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .info-item h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .info-item p {
          color: var(--muted);
        }

        .contact-form-container {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
        }

        .contact-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .btn-full {
          width: 100%;
          padding: 14px;
          font-size: 16px;
        }

        .success-message {
          text-align: center;
          padding: 40px 20px;
        }

        .success-icon {
          width: 64px;
          height: 64px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin: 0 auto 16px;
        }

        .success-message h2 {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .success-message p {
          color: var(--muted);
        }

        @media (max-width: 768px) {
          .header-nav {
            display: none;
          }

          .contact-grid {
            grid-template-columns: 1fr;
          }

          .contact-main h1 {
            font-size: 32px;
          }
        }
      `}</style>
    </div>
  );
}
