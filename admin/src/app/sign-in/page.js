'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Link href="/" className="auth-logo">
          <span className="logo-icon">🤖</span>
          <span className="logo-text">ChattyBot</span>
        </Link>

        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="auth-subtitle">Sign in to your account</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="auth-footer">
            Don't have an account? <Link href="/sign-up">Sign up</Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, var(--bg) 0%, rgba(99, 102, 241, 0.05) 100%);
          padding: 24px;
        }

        .auth-container {
          width: 100%;
          max-width: 420px;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
          font-weight: 700;
          font-size: 24px;
          color: var(--text);
          margin-bottom: 32px;
        }

        .logo-icon {
          font-size: 32px;
        }

        .auth-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px;
        }

        .auth-card h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
          text-align: center;
        }

        .auth-subtitle {
          color: var(--muted);
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .btn-full {
          width: 100%;
          padding: 14px;
          font-size: 16px;
        }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          color: var(--muted);
        }

        .auth-footer a {
          color: var(--primary);
          text-decoration: none;
          font-weight: 500;
        }

        .auth-footer a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
