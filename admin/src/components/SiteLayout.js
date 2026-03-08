'use client';

import { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';

export default function SiteLayout({ children, siteName = 'Client' }) {
  const pathname = usePathname();
  const { id } = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: `/dashboard/sites/${id}/leads`, label: 'Leads', icon: '👥' },
    { href: `/dashboard/sites/${id}/conversations`, label: 'Chats', icon: '💬' },
    { href: `/dashboard/sites/${id}/missed-leads`, label: 'Missed Leads', icon: '⚠️' },
    { href: `/dashboard/sites/${id}/analytics`, label: 'Analytics', icon: '📊' },
    { href: `/dashboard/sites/${id}/reports`, label: 'Reports', icon: '📈' },
    { href: `/dashboard/sites/${id}/files`, label: 'Files', icon: '📁' },
    { href: `/dashboard/sites/${id}/rag-eval`, label: 'RAG Test', icon: '🎯' },
    { href: `/dashboard/sites/${id}/settings`, label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (item) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="site-layout">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="site-hamburger"
        aria-label="Toggle menu"
      >
        {mobileOpen ? '×' : '☰'}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="site-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`site-sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo & Back */}
        <Link href="/" className="site-logo">
          <span className="logo-icon">🤖</span>
          <span className="logo-text">ChattyBot</span>
        </Link>

        {/* Client Name */}
        <div className="client-badge">
          <div className="badge-label">CLIENT</div>
          <div className="badge-name">{siteName}</div>
        </div>

        {/* Navigation */}
        <nav className="site-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-item ${isActive(item) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Back to Dashboard */}
        <div className="site-footer">
          <Link href="/dashboard" className="back-link">
            ← All Clients
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="site-main">{children}</main>

      <style jsx global>{`
        .site-layout {
          display: flex;
          min-height: 100vh;
        }
        
        .site-hamburger {
          display: none;
          position: fixed;
          top: 16px;
          left: 16px;
          z-index: 1001;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
        }
        
        .site-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }
        
        .site-sidebar {
          width: 220px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          z-index: 1000;
        }
        
        .site-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px;
          text-decoration: none;
          border-bottom: 1px solid var(--border);
        }
        
        .site-logo .logo-icon { font-size: 22px; }
        .site-logo .logo-text { font-weight: 700; font-size: 16px; color: var(--primary); }
        
        .client-badge {
          padding: 16px 20px;
          background: var(--bg);
          border-bottom: 1px solid var(--border);
        }
        
        .badge-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--muted);
          letter-spacing: 0.1em;
          margin-bottom: 4px;
        }
        
        .badge-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .site-nav {
          flex: 1;
          padding: 12px 8px;
          overflow-y: auto;
        }
        
        .site-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          color: var(--muted);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          margin-bottom: 2px;
          transition: all 0.15s;
        }
        
        .site-nav-item:hover {
          background: var(--bg);
          color: var(--text);
        }
        
        .site-nav-item.active {
          background: rgba(99, 102, 241, 0.1);
          color: var(--primary);
          font-weight: 600;
        }
        
        .nav-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
        }
        
        .site-footer {
          padding: 16px 12px;
          border-top: 1px solid var(--border);
        }
        
        .back-link {
          display: block;
          padding: 10px 12px;
          border-radius: 8px;
          color: var(--muted);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.15s;
        }
        
        .back-link:hover {
          background: var(--bg);
          color: var(--text);
        }
        
        .site-main {
          margin-left: 220px;
          flex: 1;
          padding: 32px;
          max-width: 1000px;
        }
        
        @media (max-width: 900px) {
          .site-hamburger { display: block; }
          .site-overlay { display: block; }
          
          .site-sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            width: 260px;
          }
          
          .site-sidebar.open {
            transform: translateX(0);
          }
          
          .site-main {
            margin-left: 0;
            padding: 72px 16px 32px;
            max-width: 100%;
          }
        }
        
        @media (max-width: 480px) {
          .site-main {
            padding: 64px 12px 24px;
          }
        }
      `}</style>
    </div>
  );
}
