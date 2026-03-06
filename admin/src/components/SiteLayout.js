'use client';

import { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';

export default function SiteLayout({ children, siteName = 'Site' }) {
  const pathname = usePathname();
  const { id } = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: `/sites/${id}/leads`, label: '👥 Leads', icon: '👥' },
    { href: `/sites/${id}/conversations`, label: '💬 Chats', icon: '💬' },
    { href: `/sites/${id}/missed-leads`, label: '⚠️ Missed Leads', icon: '⚠️' },
    { href: `/sites/${id}/analytics`, label: '📊 Analytics', icon: '📊' },
    { href: `/sites/${id}/reports`, label: '📈 Reports', icon: '📈' },
    { href: `/sites/${id}/files`, label: '📁 Files', icon: '📁' },
    { href: `/sites/${id}/rag-eval`, label: '🎯 RAG Evaluation', icon: '🎯' },
    { href: `/sites/${id}`, label: '⚙️ Settings', icon: '⚙️' },
  ];

  const isActive = (href) => pathname === href;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="site-hamburger"
        aria-label="Toggle menu"
        style={{
          display: 'none',
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1001,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 12px',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        {mobileOpen ? '×' : '☰'}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          }}
        />
      )}

      {/* Sidebar */}
      <div
        className={`site-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: 240,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          zIndex: 1000,
          transform: 'translateX(0)',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Logo */}
        <Link
          href="/sites"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px 24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 16,
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 22 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>ChattyBot</span>
        </Link>

        {/* Client Name */}
        <div
          style={{
            padding: '0 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: 6 }}>
            CURRENT CLIENT
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{siteName}</div>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                color: isActive(item.href) ? 'var(--primary)' : 'var(--muted)',
                background: isActive(item.href) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive(item.href) ? 600 : 500,
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label.replace(/^[^\s]+\s/, '')}</span>
            </Link>
          ))}
        </nav>

        {/* Back to Clients */}
        <div style={{ padding: '0 12px', marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Link
            href="/sites"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              color: 'var(--muted)',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 14,
              transition: 'all 0.15s',
            }}
          >
            <span>←</span>
            <span>All Clients</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="site-main" style={{ marginLeft: 240, flex: 1, padding: 32, maxWidth: 1200 }}>{children}</div>
      
      <style jsx global>{`
        @media (max-width: 768px) {
          .site-hamburger { display: block !important; }
          .site-sidebar { 
            transform: translateX(-100%) !important;
            width: 260px !important;
          }
          .site-sidebar.mobile-open { transform: translateX(0) !important; }
          .site-main { 
            margin-left: 0 !important; 
            padding: 72px 16px 24px !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
